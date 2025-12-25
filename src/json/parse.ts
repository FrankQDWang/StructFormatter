import { jsonrepair } from 'jsonrepair';

import { extractJsonCandidates } from './extract';

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function tryParseJson(text: string, opts: { enableRepair: boolean }): ParseResult {
  const candidates = extractJsonCandidates(text);
  const all = candidates.length ? candidates : [text.trim()];

  let lastError = 'failed to parse JSON';
  for (const c of all) {
    try {
      return { ok: true, value: JSON.parse(c) };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    if (opts.enableRepair) {
      try {
        const repaired = jsonrepair(c);
        return { ok: true, value: JSON.parse(repaired) };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return { ok: false, error: lastError };
}

