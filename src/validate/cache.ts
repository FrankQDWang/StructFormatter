import { createHash } from 'node:crypto';

import type { ValidateFunction } from 'ajv';

import { createAjv, type AjvDraft } from './ajv';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function schemaHash(schema: unknown): string {
  const s = stableStringify(schema);
  return createHash('sha256').update(s).digest('hex');
}

class LruCache<V> {
  private readonly maxSize: number;
  private readonly map = new Map<string, V>();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (!oldest) break;
      this.map.delete(oldest);
    }
  }
}

export class ValidatorCache {
  private readonly cache: LruCache<ValidateFunction>;
  private readonly ajv;

  constructor(opts: { maxSize: number; draft?: AjvDraft }) {
    this.cache = new LruCache<ValidateFunction>(opts.maxSize);
    this.ajv = createAjv(opts.draft ?? '2020-12');
  }

  get(schema: unknown): ValidateFunction {
    const key = schemaHash(schema);
    const existing = this.cache.get(key);
    if (existing) return existing;

    const validate = this.ajv.compile(schema as object);
    this.cache.set(key, validate);
    return validate;
  }
}

