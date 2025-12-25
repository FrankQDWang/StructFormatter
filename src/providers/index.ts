import type { AppConfig } from '../config/schema';
import type { ProviderAdapter } from '../types/internal';
import { OpenAICompatibleAdapter } from './openai_compatible';

export interface ResolvedModel {
  provider: string;
  upstreamModel: string;
  routedModel: string;
  requestedModel: string;
}

export function resolveModel(requestedModel: string, config: AppConfig): ResolvedModel {
  const routed = config.routing.model_aliases[requestedModel] ?? requestedModel;
  const idx = routed.indexOf('/');
  if (idx <= 0 || idx === routed.length - 1) {
    throw new Error('model must be "provider/model" (or mapped by routing.model_aliases)');
  }
  const provider = routed.slice(0, idx);
  const upstreamModel = routed.slice(idx + 1);
  return { provider, upstreamModel, routedModel: routed, requestedModel };
}

export function listModelIds(config: AppConfig): string[] {
  const ids = new Set<string>();
  for (const [alias, routed] of Object.entries(config.routing.model_aliases)) {
    ids.add(alias);
    ids.add(routed);
  }
  return [...ids].sort();
}

export function createProviderRegistry(config: AppConfig): Map<string, ProviderAdapter> {
  const adapters = new Map<string, ProviderAdapter>();
  for (const [name, providerCfg] of Object.entries(config.providers)) {
    if (providerCfg.type === 'openai_compatible') {
      adapters.set(name, new OpenAICompatibleAdapter(name, providerCfg));
      continue;
    }
    throw new Error(`Unsupported provider type: ${providerCfg.type}`);
  }
  return adapters;
}

export function getAdapter(registry: Map<string, ProviderAdapter>, providerName: string): ProviderAdapter {
  const adapter = registry.get(providerName);
  if (!adapter) throw new Error(`Unknown provider: ${providerName}`);
  return adapter;
}

