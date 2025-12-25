import { Agent, fetch } from 'undici';

import type { ProviderConfig } from '../config/schema';
import type { OpenAIChatCompletionsRequest, OpenAIChatCompletionsResponse } from '../types/openai';
import type { ProviderAdapter, RequestContext } from '../types/internal';

export class UpstreamError extends Error {
  public readonly statusCode: number;
  public readonly bodyText: string;

  constructor(statusCode: number, bodyText: string) {
    super(`Upstream error ${statusCode}: ${bodyText}`);
    this.statusCode = statusCode;
    this.bodyText = bodyText;
  }
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function dropParams(req: OpenAIChatCompletionsRequest, keys: string[]): OpenAIChatCompletionsRequest {
  if (!keys.length) return req;
  const out: Record<string, unknown> = { ...req };
  for (const k of keys) delete out[k];
  return out as OpenAIChatCompletionsRequest;
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  public readonly name: string;
  public readonly supports: ProviderConfig['capabilities'];
  private readonly cfg: ProviderConfig;
  private readonly agent: Agent;

  constructor(name: string, cfg: ProviderConfig) {
    this.name = name;
    this.cfg = cfg;
    this.supports = cfg.capabilities;
    this.agent = new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 60_000 });
  }

  async chatCompletionsRaw(
    req: OpenAIChatCompletionsRequest,
    ctx: RequestContext,
  ): Promise<{
    response: Awaited<ReturnType<typeof fetch>>;
    abort: () => void;
    cleanup: () => void;
  }> {
    const url = chatCompletionsUrl(this.cfg.base_url);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.cfg.default_headers,
    };
    if (this.cfg.api_key_env && !headers.Authorization) {
      const apiKey = process.env[this.cfg.api_key_env];
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstreamReq = dropParams(req, this.cfg.drop_params);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ctx.timeoutMs);
    t.unref?.();

    let resp: Awaited<ReturnType<typeof fetch>>;
    try {
      resp = await fetch(url, {
        dispatcher: this.agent,
        method: 'POST',
        headers,
        body: JSON.stringify(upstreamReq),
        signal: ac.signal,
      });
    } catch (e) {
      clearTimeout(t);
      throw e;
    }

    if (!resp.ok) {
      const text = await resp.text();
      clearTimeout(t);
      throw new UpstreamError(resp.status, text);
    }

    return {
      response: resp,
      abort: () => ac.abort(),
      cleanup: () => clearTimeout(t),
    };
  }

  async chatCompletions(
    req: OpenAIChatCompletionsRequest,
    ctx: RequestContext,
  ): Promise<OpenAIChatCompletionsResponse> {
    const raw = await this.chatCompletionsRaw(req, ctx);
    try {
      const text = await raw.response.text();
      return JSON.parse(text) as OpenAIChatCompletionsResponse;
    } finally {
      raw.cleanup();
    }
  }
}
