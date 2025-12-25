import { describe, expect, it } from 'vitest';

import { tryParseJson } from '../src/json/parse';

describe('json parse/repair', () => {
  it('repairs invalid json when enabled', () => {
    const r = tryParseJson('```json\n{a:1,}\n```', { enableRepair: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1 });
  });

  it('fails without repair', () => {
    const r = tryParseJson('```json\n{a:1,}\n```', { enableRepair: false });
    expect(r.ok).toBe(false);
  });
});

