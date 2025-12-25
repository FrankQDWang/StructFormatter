import type { OpenAIChatMessage } from '../types/openai';
import type { ValidationErrorSummary } from '../validate/errors';
import { sanitizeSchemaForPrompt } from './sanitize_schema';
import { firstAttemptSystemPrompt, reaskSystemPrompt } from './templates';

function formatErrors(errors: ValidationErrorSummary[] | undefined): string {
  if (!errors?.length) return '(none)';
  return errors.slice(0, 50).map((e) => `- ${e.path}: ${e.message}`).join('\n');
}

export function buildMessages(args: {
  original: OpenAIChatMessage[];
  schema: Record<string, unknown>;
  attempt: number;
  lastCandidate?: unknown;
  lastErrors?: ValidationErrorSummary[];
}): OpenAIChatMessage[] {
  const schemaJson = JSON.stringify(sanitizeSchemaForPrompt(args.schema), null, 0);

  const system =
    args.attempt === 1
      ? firstAttemptSystemPrompt(schemaJson)
      : reaskSystemPrompt({
          schemaJson,
          lastCandidateJson: JSON.stringify(args.lastCandidate ?? null),
          errorsText: formatErrors(args.lastErrors),
        });

  return [{ role: 'system', content: system }, ...args.original];
}

