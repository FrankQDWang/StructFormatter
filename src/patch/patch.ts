function schemaExpectsType(schema: unknown, expected: string): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const t = (schema as Record<string, unknown>).type;
  if (typeof t === 'string') return t === expected;
  if (Array.isArray(t)) return t.includes(expected);
  return false;
}

function coercePrimitive(schema: unknown, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string' && schemaExpectsType(schema, 'integer')) {
    const s = value.trim();
    if (/^[+-]?\d+$/.test(s)) {
      const n = Number(s);
      if (Number.isSafeInteger(n)) return n;
    }
  }

  if (typeof value === 'string' && schemaExpectsType(schema, 'number')) {
    const s = value.trim();
    if (/^[+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:[eE][+-]?\d+)?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }
  }

  if (typeof value === 'string' && schemaExpectsType(schema, 'boolean')) {
    const s = value.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }

  return value;
}

export function patchToSchema(
  schema: unknown,
  value: unknown,
  opts: { enableTypeCoercion: boolean },
): unknown {
  if (!schema || typeof schema !== 'object') return value;

  const patchedValue = opts.enableTypeCoercion ? coercePrimitive(schema, value) : value;

  if (schemaExpectsType(schema, 'object') && patchedValue && typeof patchedValue === 'object') {
    if (Array.isArray(patchedValue)) return patchedValue;

    const s = schema as Record<string, unknown>;
    const props = (s.properties && typeof s.properties === 'object' ? s.properties : {}) as Record<
      string,
      unknown
    >;
    const additionalAllowed = s.additionalProperties !== false;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patchedValue as Record<string, unknown>)) {
      if (!additionalAllowed && !(k in props)) continue;
      const childSchema = props[k];
      out[k] =
        childSchema && typeof childSchema === 'object'
          ? patchToSchema(childSchema, v, opts)
          : v;
    }
    return out;
  }

  if (schemaExpectsType(schema, 'array') && Array.isArray(patchedValue)) {
    const s = schema as Record<string, unknown>;
    const items = s.items;
    if (items && typeof items === 'object') {
      return patchedValue.map((v) => patchToSchema(items, v, opts));
    }
    return patchedValue;
  }

  return patchedValue;
}

