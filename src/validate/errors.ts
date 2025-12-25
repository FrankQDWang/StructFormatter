import type { ErrorObject } from 'ajv';

export interface ValidationErrorSummary {
  path: string;
  message: string;
  keyword: string;
  params?: unknown;
}

export function summarizeAjvErrors(errors: ErrorObject[] | null | undefined): ValidationErrorSummary[] {
  if (!errors?.length) return [];
  return errors.slice(0, 50).map((e) => ({
    path: e.instancePath || '/',
    message: e.message ?? 'validation error',
    keyword: e.keyword,
    params: e.params,
  }));
}

