export function firstAttemptSystemPrompt(schemaJson: string): string {
  return [
    'You MUST output ONLY valid JSON (no markdown, no code fences, no explanation).',
    'The JSON MUST conform to the following JSON Schema:',
    schemaJson,
  ].join('\n');
}

export function reaskSystemPrompt(args: {
  schemaJson: string;
  lastCandidateJson: string;
  errorsText: string;
}): string {
  return [
    'You previously returned JSON that failed validation.',
    'Return ONLY corrected JSON that conforms to the schema.',
    'Do NOT add any keys not present in schema.',
    'Do NOT include markdown.',
    '',
    'Schema:',
    args.schemaJson,
    '',
    'Previous JSON:',
    args.lastCandidateJson,
    '',
    'Validation errors:',
    args.errorsText,
  ].join('\n');
}

