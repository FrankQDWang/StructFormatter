import { describe, expect, it } from 'vitest';

import { ValidatorCache } from '../src/validate/cache';

describe('validator cache', () => {
  it('reuses the compiled validator for identical schema', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: { a: { type: 'integer' } },
    };
    const cache = new ValidatorCache({ maxSize: 2 });
    const v1 = cache.get(schema);
    const v2 = cache.get(schema);
    expect(v1).toBe(v2);
  });
});

