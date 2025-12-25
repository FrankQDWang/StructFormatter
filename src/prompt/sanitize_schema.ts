const DROP_KEYS = new Set([
  'title',
  'description',
  'examples',
  'default',
  'deprecated',
  'readOnly',
  'writeOnly',
]);

export function sanitizeSchemaForPrompt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeSchemaForPrompt);
  if (!value || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (DROP_KEYS.has(k)) continue;
    out[k] = sanitizeSchemaForPrompt(v);
  }
  return out;
}

