#!/usr/bin/env node

import { loadConfig, summarizeConfig } from './config/load';
import { createServer } from './server';

function printHelp() {
  console.log(
    [
      'StructFormatter (OpenAI-compatible structured output proxy)',
      '',
      'Usage:',
      '  structformatter [--config <path>]',
      '',
      'Options:',
      '  --config, -c   Path to config.yaml/config.json (defaults to STRUCTFORMATTER_CONFIG or ./config.{yaml,yml,json})',
      '  --help, -h     Show this help',
      '',
    ].join('\n'),
  );
}

function parseArgs(argv: string[]) {
  let configPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true as const };
    if (a === '--config' || a === '-c') {
      configPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (a.startsWith('--config=')) {
      configPath = a.slice('--config='.length);
      continue;
    }
  }
  return { help: false as const, configPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = loadConfig(args.configPath);
  console.log(summarizeConfig(config));

  const app = createServer(config);
  await app.listen({ port: config.server.port, host: config.server.host });
}

void main();
