import type { StructuredError } from '../types/internal';
import type { ValidationErrorSummary } from '../validate/errors';

export function structuredOutputFailed(args: {
  attempts: number;
  lastCandidateExcerpt: string;
  validationErrors: ValidationErrorSummary[];
  attemptTraces?: unknown[];
}): StructuredError {
  return {
    ok: false,
    attempts: args.attempts,
    attemptTraces: args.attemptTraces,
    error: {
      type: 'structured_output_failed',
      message: `Failed to produce schema-valid JSON after ${args.attempts} attempts`,
      details: {
        attempts: args.attempts,
        last_candidate_excerpt: args.lastCandidateExcerpt,
        validation_errors: args.validationErrors,
      },
    },
  };
}

export function upstreamError(args: {
  message: string;
  attempts: number;
  attemptTraces?: unknown[];
}): StructuredError {
  return {
    ok: false,
    attempts: args.attempts,
    attemptTraces: args.attemptTraces,
    error: { type: 'upstream_error', message: args.message, details: { attempts: args.attempts } },
  };
}

export function refusalError(args: {
  finishReason: string;
  attempts: number;
  attemptTraces?: unknown[];
}): StructuredError {
  return {
    ok: false,
    attempts: args.attempts,
    attemptTraces: args.attemptTraces,
    error: {
      type: 'refusal',
      message: 'Upstream refused to answer',
      details: { finish_reason: args.finishReason, attempts: args.attempts },
    },
  };
}

