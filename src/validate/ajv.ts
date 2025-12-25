import Ajv2019 from 'ajv/dist/2019';
import Ajv2020 from 'ajv/dist/2020';
import type { AnySchemaObject } from 'ajv';

export type AjvDraft = '2019-09' | '2020-12';

export function createAjv(draft: AjvDraft = '2020-12') {
  const AjvCtor = draft === '2019-09' ? Ajv2019 : Ajv2020;
  return new AjvCtor({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: true,
    messages: true,
  });
}

export type JsonSchema = AnySchemaObject;

