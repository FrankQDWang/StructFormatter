import { describe, expect, it } from 'vitest';

import { extractJsonCandidates, stripCodeFences } from '../src/json/extract';

describe('json extraction', () => {
  it('keeps the largest fenced block', () => {
    const text = 'x```json\n{"a":1}\n```y```json\n{"a":1,"b":2}\n```z';
    expect(stripCodeFences(text).trim()).toBe('{"a":1,"b":2}');
  });

  it('extracts object candidates', () => {
    const text = 'Here is the output:\n```json\n{"a":1}\n```\nThanks!';
    expect(extractJsonCandidates(text)[0]).toBe('{"a":1}');
  });
});

