import { describe, expect, it } from 'vitest';

import { patchToSchema } from '../src/patch/patch';

describe('deterministic patch', () => {
  it('removes additional properties and coerces types', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['age'],
      properties: { age: { type: 'integer' } },
    };

    const candidate = { age: '42', extra: 'nope' };
    const patched = patchToSchema(schema, candidate, { enableTypeCoercion: true });
    expect(patched).toEqual({ age: 42 });
  });

  it('can disable type coercion', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: { age: { type: 'integer' } },
    };
    const candidate = { age: '42' };
    const patched = patchToSchema(schema, candidate, { enableTypeCoercion: false });
    expect(patched).toEqual({ age: '42' });
  });
});

