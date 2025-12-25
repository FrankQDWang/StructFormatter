import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { AppConfigSchema, type AppConfig } from './schema';

function readConfigFile(filePath: string): unknown {
  const text = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') return YAML.parse(text);
  if (ext === '.json') return JSON.parse(text);
  throw new Error(`Unsupported config extension: ${ext}`);
}

function candidatePaths(explicitPath?: string): string[] {
  const fromEnv = process.env.STRUCTUREDFORMATTER_CONFIG;
  const candidates = [
    explicitPath,
    fromEnv && fromEnv !== explicitPath ? fromEnv : undefined,
    'config.yaml',
    'config.yml',
    'config.json',
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

export function loadConfig(explicitPath?: string): AppConfig {
  let raw: unknown = {};
  for (const p of candidatePaths(explicitPath)) {
    if (!fs.existsSync(p)) continue;
    raw = readConfigFile(p);
    break;
  }

  const config = AppConfigSchema.parse(raw);

  if (process.env.STRUCTUREDFORMATTER_HOST) config.server.host = process.env.STRUCTUREDFORMATTER_HOST;
  if (process.env.STRUCTUREDFORMATTER_PORT) {
    const port = Number(process.env.STRUCTUREDFORMATTER_PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error('STRUCTUREDFORMATTER_PORT must be an integer in [1, 65535].');
    }
    config.server.port = port;
  }

  return config;
}

export function summarizeConfig(config: AppConfig): string {
  const providers = Object.keys(config.providers).sort().join(', ') || '(none)';
  return [
    'StructuredFormatter config:',
    `- server: ${config.server.host}:${config.server.port}`,
    `- enforcement: max_attempts=${config.enforcement.max_attempts}, timeout_ms_per_attempt=${config.enforcement.timeout_ms_per_attempt}`,
    `- providers: ${providers}`,
  ].join('\n');
}

