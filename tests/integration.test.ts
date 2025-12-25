import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { AppConfigSchema } from '../src/config/schema';
import { createServer } from '../src/server';

function upstreamResponse(content: string, model: string, n: number) {
  return {
    id: `up_${n}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('integration', () => {
  it('enforces json_schema via repair + re-ask loop', async () => {
    const upstream = Fastify({ logger: false });
    let n = 0;
    upstream.post('/v1/chat/completions', async (req) => {
      n += 1;
      const body = req.body as { model?: unknown } | undefined;
      const model = typeof body?.model === 'string' ? body.model : 'unknown';
      if (n === 1) return upstreamResponse('```json\n{a:}\n```', model, n);
      if (n === 2) return upstreamResponse('{"a":"x"}', model, n);
      return upstreamResponse('{"a":1}', model, n);
    });

    await upstream.listen({ port: 0, host: '127.0.0.1' });
    const addr = upstream.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const config = AppConfigSchema.parse({
      enforcement: { max_attempts: 3, timeout_ms_per_attempt: 5_000, validator_cache_size: 64 },
      providers: { mock: { type: 'openai_compatible', base_url: baseUrl, capabilities: { json_object: true } } },
      routing: { mode: 'provider_prefix', model_aliases: {} },
    });

    const app = createServer(config);

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['a'],
      properties: { a: { type: 'integer' } },
    };

    const payload = {
      model: 'mock/test-model',
      messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_schema', json_schema: { name: 'T', strict: true, schema } },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload,
      headers: { 'x-sf-debug': '1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      __debug: { attempts: number };
    };
    expect(JSON.parse(body.choices[0].message.content)).toEqual({ a: 1 });
    expect(body.model).toBe('mock/test-model');
    expect(body.__debug.attempts).toBe(3);
    expect(body.usage).toEqual({ prompt_tokens: 3, completion_tokens: 3, total_tokens: 6 });

    await app.close();
    await upstream.close();
  });
});
