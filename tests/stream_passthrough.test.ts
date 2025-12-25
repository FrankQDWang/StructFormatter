import { Readable } from 'node:stream';

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { AppConfigSchema } from '../src/config/schema';
import { createServer } from '../src/server';

describe('stream pass-through', () => {
  it('proxies upstream SSE when stream=true (non json_schema)', async () => {
    const upstream = Fastify({ logger: false });
    upstream.post('/v1/chat/completions', async (req, reply) => {
      const body = req.body as { model?: unknown } | undefined;
      const model = typeof body?.model === 'string' ? body.model : 'unknown';
      reply.header('content-type', 'text/event-stream');

      const created = Math.floor(Date.now() / 1000);
      const chunk = {
        id: 'up_stream_1',
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }],
      };

      const s = Readable.from([`data: ${JSON.stringify(chunk)}\n\n`, 'data: [DONE]\n\n']);
      return reply.send(s);
    });

    await upstream.listen({ port: 0, host: '127.0.0.1' });
    const addr = upstream.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const config = AppConfigSchema.parse({
      enforcement: { timeout_ms_per_attempt: 5_000 },
      providers: {
        mock: { type: 'openai_compatible', base_url: baseUrl, capabilities: { json_object: true } },
      },
    });

    const app = createServer(config);

    const payload = {
      model: 'mock/test-model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    };

    const res = await app.inject({ method: 'POST', url: '/v1/chat/completions', payload });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'] ?? '')).toContain('text/event-stream');

    const lines = res.payload.split('\n').map((l) => l.trim()).filter(Boolean);
    const dataLine = lines.find((l) => l.startsWith('data:') && !l.includes('[DONE]'));
    expect(dataLine).toBeTruthy();

    const jsonText = dataLine!.slice('data:'.length).trim();
    const obj = JSON.parse(jsonText) as { model?: unknown };
    expect(obj.model).toBe('mock/test-model');

    await app.close();
    await upstream.close();
  });
});

