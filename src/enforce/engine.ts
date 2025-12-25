import type { ValidateFunction } from 'ajv';

import type {
  EnforcementPolicy,
  ProviderAdapter,
  RequestContext,
  StructuredError,
  StructuredResult,
} from '../types/internal';
import type { OpenAIChatCompletionsRequest, OpenAIChatCompletionsResponse } from '../types/openai';
import { tryParseJson } from '../json/parse';
import { patchToSchema } from '../patch/patch';
import { buildMessages } from '../prompt/build';
import type { ValidatorCache } from '../validate/cache';
import { summarizeAjvErrors, type ValidationErrorSummary } from '../validate/errors';
import { refusalError, structuredOutputFailed, upstreamError } from './errors';

function extractCandidateText(resp: OpenAIChatCompletionsResponse): string | null {
  const c = resp.choices?.[0];
  const content = c?.message?.content;
  return typeof content === 'string' ? content : null;
}

function finishReason(resp: OpenAIChatCompletionsResponse): string | null {
  const fr = resp.choices?.[0]?.finish_reason;
  return typeof fr === 'string' ? fr : null;
}

function usageFrom(resp: OpenAIChatCompletionsResponse) {
  const u = resp.usage ?? {};
  return {
    prompt_tokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0,
    completion_tokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
    total_tokens: typeof u.total_tokens === 'number' ? u.total_tokens : 0,
  };
}

function addUsage(a: { prompt_tokens: number; completion_tokens: number; total_tokens: number }, b: typeof a) {
  return {
    prompt_tokens: a.prompt_tokens + b.prompt_tokens,
    completion_tokens: a.completion_tokens + b.completion_tokens,
    total_tokens: a.total_tokens + b.total_tokens,
  };
}

export async function enforceJsonSchema(args: {
  requestId: string;
  adapter: ProviderAdapter;
  provider: string;
  baseUrl: string;
  upstreamModel: string;
  originalRequest: OpenAIChatCompletionsRequest;
  schema: Record<string, unknown>;
  policy: EnforcementPolicy;
  validatorCache: ValidatorCache;
  debug: boolean;
}): Promise<StructuredResult | StructuredError> {
  const validate: ValidateFunction = args.validatorCache.get(args.schema);

  let lastCandidate: unknown | undefined;
  let lastErrors: ValidationErrorSummary[] | undefined;
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const traces: unknown[] = [];

  for (let attempt = 1; attempt <= args.policy.maxAttempts; attempt++) {
    const messages = buildMessages({
      original: args.originalRequest.messages,
      schema: args.schema,
      attempt,
      lastCandidate,
      lastErrors,
    });

    const req: OpenAIChatCompletionsRequest = {
      ...args.originalRequest,
      model: args.upstreamModel,
      messages,
      stream: false,
    };

    // Prefer upstream JSON mode to reduce syntax errors.
    if (args.adapter.supports.json_object) req.response_format = { type: 'json_object' };
    else delete req.response_format;

    const ctx: RequestContext = {
      requestId: args.requestId,
      timeoutMs: args.policy.timeoutMsPerAttempt,
      provider: args.provider,
      baseUrl: args.baseUrl,
      upstreamModel: args.upstreamModel,
    };

    let upstreamResp: OpenAIChatCompletionsResponse;
    try {
      upstreamResp = await args.adapter.chatCompletions(req, ctx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      traces.push({ attempt, kind: 'upstream_error', message: msg });
      return upstreamError({
        message: msg,
        attempts: attempt,
        attemptTraces: args.debug ? traces : undefined,
      });
    }

    usage = addUsage(usage, usageFrom(upstreamResp));

    const fr = finishReason(upstreamResp);
    if (fr === 'refusal' || fr === 'content_filter') {
      traces.push({ attempt, kind: 'refusal', finish_reason: fr });
      return refusalError({
        finishReason: fr,
        attempts: attempt,
        attemptTraces: args.debug ? traces : undefined,
      });
    }

    const candidateText = extractCandidateText(upstreamResp);
    if (!candidateText) {
      lastCandidate = undefined;
      lastErrors = [{ path: '/', keyword: 'parse', message: 'missing assistant content' }];
      traces.push({ attempt, kind: 'no_content' });
      continue;
    }

    const parsed = tryParseJson(candidateText, { enableRepair: args.policy.enableJsonRepair });
    if (!parsed.ok) {
      lastCandidate = undefined;
      lastErrors = [{ path: '/', keyword: 'parse', message: parsed.error }];
      traces.push({ attempt, kind: 'parse_error', error: parsed.error });
      continue;
    }

    const candidateObj = parsed.value;
    const valid = validate(candidateObj) as boolean;
    if (valid) {
      const jsonText = JSON.stringify(candidateObj);
      traces.push({ attempt, kind: 'ok' });
      return {
        ok: true,
        json: candidateObj,
        jsonText,
        usage,
        attempts: attempt,
        attemptTraces: args.debug ? traces : undefined,
      };
    }

    let errors = summarizeAjvErrors(validate.errors);
    let finalCandidate = candidateObj;

    if (args.policy.enableDeterministicFix) {
      const patched = patchToSchema(args.schema, candidateObj, {
        enableTypeCoercion: args.policy.enableTypeCoercion,
      });
      const valid2 = validate(patched) as boolean;
      if (valid2) {
        const jsonText = JSON.stringify(patched);
        traces.push({ attempt, kind: 'patched_ok' });
        return {
          ok: true,
          json: patched,
          jsonText,
          usage,
          attempts: attempt,
          attemptTraces: args.debug ? traces : undefined,
        };
      }

      errors = summarizeAjvErrors(validate.errors);
      finalCandidate = patched;
    }

    lastCandidate = finalCandidate;
    lastErrors = errors;
    traces.push({ attempt, kind: 'schema_invalid', errors });
  }

  const excerpt = lastCandidate ? JSON.stringify(lastCandidate).slice(0, 500) : '';
  return structuredOutputFailed({
    attempts: args.policy.maxAttempts,
    lastCandidateExcerpt: excerpt,
    validationErrors: lastErrors ?? [],
    attemptTraces: args.debug ? traces : undefined,
  });
}

