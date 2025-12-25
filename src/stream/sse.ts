import { Transform } from 'node:stream';

function rewriteEvent(eventText: string, requestedModel: string): string {
  const newline = eventText.includes('\r\n') ? '\r\n' : '\n';
  const lines = eventText.split(/\r?\n/);

  const out = lines.map((line) => {
    if (!line.startsWith('data:')) return line;
    const data = line.slice('data:'.length).trimStart();
    if (!data) return line;
    if (data === '[DONE]') return 'data: [DONE]';

    try {
      const obj = JSON.parse(data) as unknown;
      if (obj && typeof obj === 'object') {
        const rec = obj as Record<string, unknown>;
        if (typeof rec.model === 'string') rec.model = requestedModel;
      }
      return `data: ${JSON.stringify(obj)}`;
    } catch {
      return line;
    }
  });

  return out.join(newline);
}

export function createSseModelRewriteTransform(requestedModel: string): Transform {
  let buffer = '';
  return new Transform({
    transform(chunk, _enc, cb) {
      buffer += chunk.toString('utf8');

      while (true) {
        const lf = buffer.indexOf('\n\n');
        const crlf = buffer.indexOf('\r\n\r\n');
        const hasLf = lf !== -1;
        const hasCrlf = crlf !== -1;

        if (!hasLf && !hasCrlf) break;

        const idx = hasLf && hasCrlf ? Math.min(lf, crlf) : hasLf ? lf : crlf;
        const sep = idx === crlf ? '\r\n\r\n' : '\n\n';

        const eventText = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sep.length);
        this.push(rewriteEvent(eventText, requestedModel) + sep);
      }

      cb();
    },
    flush(cb) {
      if (buffer) this.push(buffer);
      cb();
    },
  });
}

