import type { OpenAIChatCompletionsRequest, OpenAIChatCompletionsResponse } from './openai';

export interface ProviderCapabilities {
  json_object?: boolean;
  tools?: boolean;
  strict_tools?: boolean;
}

export interface RequestContext {
  requestId: string;
  timeoutMs: number;
  provider: string;
  baseUrl: string;
  upstreamModel: string;
}

export interface ProviderAdapter {
  name: string;
  supports: ProviderCapabilities;
  chatCompletions(
    req: OpenAIChatCompletionsRequest,
    ctx: RequestContext,
  ): Promise<OpenAIChatCompletionsResponse>;
}

export interface EnforcementPolicy {
  maxAttempts: number;
  timeoutMsPerAttempt: number;
  enableJsonRepair: boolean;
  enableDeterministicFix: boolean;
  enableTypeCoercion: boolean;
}

export interface StructuredResult {
  ok: true;
  json: unknown;
  jsonText: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  attempts: number;
  attemptTraces?: unknown[];
}

export interface StructuredError {
  ok: false;
  error: {
    type: string;
    message: string;
    details?: Record<string, unknown>;
  };
  attempts: number;
  attemptTraces?: unknown[];
}

export class StructFormatterError extends Error {
  public readonly type: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(type: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }
}
