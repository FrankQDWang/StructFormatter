import { z } from 'zod';

export const ServerConfigSchema = z
  .object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().min(1).max(65535).default(18081),
    request_body_limit_mb: z.number().int().min(1).max(100).default(2),
  })
  .default({ host: '0.0.0.0', port: 18081, request_body_limit_mb: 2 });

export const EnforcementConfigSchema = z
  .object({
    max_attempts: z.number().int().min(1).max(10).default(3),
    timeout_ms_per_attempt: z.number().int().min(100).default(20_000),
    enable_jsonrepair: z.boolean().default(true),
    enable_deterministic_fix: z.boolean().default(true),
    enable_type_coercion: z.boolean().default(true),
    schema_max_bytes: z.number().int().min(1_000).default(200_000),
    validator_cache_size: z.number().int().min(1).max(10_000).default(128),
  })
  .default({
    max_attempts: 3,
    timeout_ms_per_attempt: 20_000,
    enable_jsonrepair: true,
    enable_deterministic_fix: true,
    enable_type_coercion: true,
    schema_max_bytes: 200_000,
    validator_cache_size: 128,
  });

export const RoutingConfigSchema = z
  .object({
    mode: z.literal('provider_prefix').default('provider_prefix'),
    model_aliases: z.record(z.string(), z.string()).default({}),
  })
  .default({ mode: 'provider_prefix', model_aliases: {} });

export const ProviderCapabilitiesSchema = z
  .object({
    json_object: z.boolean().default(false),
    tools: z.boolean().default(false),
    strict_tools: z.boolean().default(false),
  })
  .default({ json_object: false, tools: false, strict_tools: false });

export const ProviderConfigSchema = z.object({
  type: z.literal('openai_compatible').default('openai_compatible'),
  base_url: z.string().min(1),
  api_key_env: z.string().min(1).optional(),
  beta_base_url: z.string().min(1).optional(),
  default_headers: z.record(z.string(), z.string()).default({}),
  drop_params: z.array(z.string()).default([]),
  capabilities: ProviderCapabilitiesSchema,
});

export const AppConfigSchema = z
  .object({
    server: ServerConfigSchema,
    enforcement: EnforcementConfigSchema,
    routing: RoutingConfigSchema,
    providers: z.record(z.string(), ProviderConfigSchema).default({}),
  })
  .default({
    server: { host: '0.0.0.0', port: 18081, request_body_limit_mb: 2 },
    enforcement: {
      max_attempts: 3,
      timeout_ms_per_attempt: 20_000,
      enable_jsonrepair: true,
      enable_deterministic_fix: true,
      enable_type_coercion: true,
      schema_max_bytes: 200_000,
      validator_cache_size: 128,
    },
    routing: { mode: 'provider_prefix', model_aliases: {} },
    providers: {},
  });

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
