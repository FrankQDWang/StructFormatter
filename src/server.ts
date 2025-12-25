import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import type { AppConfig } from './config/schema';
import { enforceJsonSchema } from './enforce/engine';
import { createProviderRegistry, getAdapter, listModelIds, resolveModel } from './providers';
import type { OpenAIChatCompletionsRequest, OpenAIResponseFormatJsonSchema } from './types/openai';
import type { EnforcementPolicy } from './types/internal';
import { ValidatorCache } from './validate/cache';
import { createSseModelRewriteTransform } from './stream/sse';

type HeadersLike = {
  get: (name: string) => string | null;
  forEach: (cb: (value: string, key: string) => void) => void;
};

type RawCapableAdapter = {
  chatCompletionsRaw: (
    req: OpenAIChatCompletionsRequest,
    ctx: { requestId: string; timeoutMs: number; provider: string; baseUrl: string; upstreamModel: string },
  ) => Promise<{
    response: { status: number; headers: HeadersLike; body: unknown | null };
    abort: () => void;
    cleanup: () => void;
  }>;
};

function isRawCapableAdapter(v: unknown): v is RawCapableAdapter {
  return typeof (v as { chatCompletionsRaw?: unknown }).chatCompletionsRaw === 'function';
}

function setProxyHeaders(reply: { header: (k: string, v: string) => void }, headers: HeadersLike) {
  const skip = new Set(['content-length', 'transfer-encoding', 'connection', 'keep-alive']);
  headers.forEach((value, key) => {
    if (skip.has(key.toLowerCase())) return;
    reply.header(key, value);
  });
}

function toBoolHeader(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false';
}

function parseMaxAttemptsHeader(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  return Math.max(1, Math.min(n, 10));
}

function openaiError(type: string, message: string, details?: Record<string, unknown>) {
  return { error: { type, message, details } };
}

function chatCompletionResponse(args: {
  model: string;
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  debug?: Record<string, unknown>;
}) {
  const base: Record<string, unknown> = {
    id: `chatcmpl_${randomUUID().replace(/-/g, '')}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: args.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: args.content },
        finish_reason: 'stop',
      },
    ],
    usage: args.usage,
  };
  if (args.debug) base.__debug = args.debug;
  return base;
}

export function createServer(config: AppConfig) {
  const app = Fastify({
    logger:
      process.env.NODE_ENV === 'test'
        ? false
        : { level: process.env.STRUCTUREDFORMATTER_LOG_LEVEL ?? 'info' },
    bodyLimit: config.server.request_body_limit_mb * 1024 * 1024,
    genReqId: () => randomUUID(),
  });

  const registry = createProviderRegistry(config);
  const validatorCache = new ValidatorCache({ maxSize: config.enforcement.validator_cache_size });

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/v1/models', async () => ({
    object: 'list',
    data: listModelIds(config).map((id) => ({ id, object: 'model' })),
  }));

  app.post('/v1/chat/completions', async (req, reply) => {
    const body = req.body as unknown;
    if (!body || typeof body !== 'object') {
      return reply.code(400).send(openaiError('invalid_request', 'request body must be a JSON object'));
    }

    const request = body as OpenAIChatCompletionsRequest;
    if (typeof request.model !== 'string' || !request.model) {
      return reply.code(400).send(openaiError('invalid_request', 'missing model'));
    }
    if (!Array.isArray(request.messages)) {
      return reply.code(400).send(openaiError('invalid_request', 'messages must be an array'));
    }

    const requestId = String(req.id);
    const debug = toBoolHeader(req.headers['x-sf-debug']);
    const maxAttemptsOverride = parseMaxAttemptsHeader(req.headers['x-sf-max-attempts']);

    let resolved;
    try {
      resolved = resolveModel(request.model, config);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send(openaiError('invalid_request', msg));
    }

    let adapter;
    try {
      adapter = getAdapter(registry, resolved.provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send(openaiError('invalid_request', msg));
    }

    const rf = request.response_format;
    if (rf && rf.type === 'json_schema') {
      if (request.stream) {
        return reply
          .code(400)
          .send(openaiError('invalid_request', 'streaming not supported for schema-enforced requests'));
      }

      const schema = (rf as OpenAIResponseFormatJsonSchema).json_schema?.schema;
      if (!schema || typeof schema !== 'object') {
        return reply
          .code(400)
          .send(openaiError('invalid_request', 'response_format.json_schema.schema must be an object'));
      }

      const schemaBytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
      if (schemaBytes > config.enforcement.schema_max_bytes) {
        return reply.code(400).send(openaiError('invalid_request', 'schema too large'));
      }

      const policy: EnforcementPolicy = {
        maxAttempts: maxAttemptsOverride ?? config.enforcement.max_attempts,
        timeoutMsPerAttempt: config.enforcement.timeout_ms_per_attempt,
        enableJsonRepair: config.enforcement.enable_jsonrepair,
        enableDeterministicFix: config.enforcement.enable_deterministic_fix,
        enableTypeCoercion: config.enforcement.enable_type_coercion,
      };

      const result = await enforceJsonSchema({
        requestId,
        adapter,
        provider: resolved.provider,
        baseUrl: config.providers[resolved.provider]?.base_url ?? '',
        upstreamModel: resolved.upstreamModel,
        originalRequest: request,
        schema: schema as Record<string, unknown>,
        policy,
        validatorCache,
        debug,
      });

      if (!result.ok) {
        const status = result.error.type === 'upstream_error' ? 502 : 422;
        const payload: Record<string, unknown> = { error: result.error };
        if (debug) {
          payload.__debug = { request_id: requestId, attempts: result.attempts, traces: result.attemptTraces };
        }
        return reply.code(status).send(payload);
      }

      return reply.code(200).send(
        chatCompletionResponse({
          model: request.model,
          content: result.jsonText,
          usage: result.usage,
          debug: debug ? { request_id: requestId, attempts: result.attempts, traces: result.attemptTraces } : undefined,
        }),
      );
    }

    const upstreamReq = { ...request, model: resolved.upstreamModel };
    const ctx = {
      requestId,
      timeoutMs: config.enforcement.timeout_ms_per_attempt,
      provider: resolved.provider,
      baseUrl: config.providers[resolved.provider]?.base_url ?? '',
      upstreamModel: resolved.upstreamModel,
    };

    if (request.stream) {
      if (!isRawCapableAdapter(adapter)) {
        return reply
          .code(400)
          .send(openaiError('invalid_request', 'streaming not supported for this provider'));
      }

      try {
        const raw = await adapter.chatCompletionsRaw(upstreamReq, ctx);
        setProxyHeaders(reply, raw.response.headers);

        const contentType = raw.response.headers.get('content-type') ?? '';
        const isEventStream = contentType.toLowerCase().includes('text/event-stream');

        const body = raw.response.body;
        if (!body) {
          raw.cleanup();
          return reply.code(200).send();
        }

        const nodeStream = Readable.fromWeb(body as NodeReadableStream<Uint8Array>);
        nodeStream.on('end', raw.cleanup);
        nodeStream.on('error', raw.cleanup);
        reply.raw.on('close', () => {
          raw.abort();
          raw.cleanup();
        });
        reply.raw.on('error', () => {
          raw.abort();
          raw.cleanup();
        });

        const outStream = isEventStream
          ? nodeStream.pipe(createSseModelRewriteTransform(request.model))
          : nodeStream;

        return reply.code(raw.response.status).send(outStream);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.code(502).send(openaiError('upstream_error', msg));
      }
    }

    try {
      const upstreamResp = await adapter.chatCompletions(upstreamReq, ctx);
      upstreamResp.model = request.model;
      return reply.code(200).send(upstreamResp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send(openaiError('upstream_error', msg));
    }
  });

  return app;
}
