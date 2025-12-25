const FENCE_RE = /```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/gi;

export function stripCodeFences(text: string): string {
  const matches = [...text.matchAll(FENCE_RE)];
  if (!matches.length) return text;
  const biggest = matches.reduce((a, b) => ((a[1]?.length ?? 0) >= (b[1]?.length ?? 0) ? a : b));
  return biggest[1] ?? text;
}

export function extractJsonCandidates(text: string): string[] {
  const cleaned = stripCodeFences(text).trim();
  const candidates: string[] = [];

  for (const [startChar, endChar] of [
    ['{', '}'],
    ['[', ']'],
  ] as const) {
    const start = cleaned.indexOf(startChar);
    const end = cleaned.lastIndexOf(endChar);
    if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1).trim());
  }

  candidates.sort((a, b) => b.length - a.length);
  return candidates;
}

