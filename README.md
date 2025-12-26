# StructFormatter

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/lang-English-blue.svg" alt="English"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/lang-简体中文-red.svg" alt="简体中文"></a>
</p>

<p align="center">
  <a href="https://github.com/FrankQDWang/StructFormatter/actions/workflows/ci.yml"><img src="https://github.com/FrankQDWang/StructFormatter/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/structformatter"><img src="https://img.shields.io/npm/v/structformatter" alt="npm"></a>
</p>

StructFormatter is an **OpenAI-compatible proxy (sidecar)** that makes **non-native** LLM APIs behave like they support **`response_format: { type: "json_schema" }`**.

It enforces schema validity via a robust “B strategy” loop:
prompting → JSON extraction → JSON repair → JSON Schema validation (Ajv) → deterministic fixes → re-ask retries.

The `specs/` directory is the source of truth (architecture, API contract, algorithm, testing plan, and checklist).

## Why you may want this

If you use agents that rely on structured outputs, many providers only offer “JSON mode” (valid JSON) but **not** JSON Schema constrained decoding.

This service lets your agent keep calling an OpenAI-shaped endpoint, while StructFormatter enforces schema validity behind the scenes.

## Quickstart (from source)

```bash
pnpm install
cp config.example.yaml config.yaml
export STRUCTFORMATTER_CONFIG=./config.yaml
pnpm dev
```

Endpoints:
- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

## Quickstart (npm)

```bash
pnpm dlx structformatter --config ./config.yaml
```

or:

```bash
npx structformatter --config ./config.yaml
```

## Agent integration (drop-in)

Point your OpenAI SDK `base_url` to this server:

- Base URL: `http://localhost:8080/v1`
- Model naming: `provider/model` (e.g. `deepseek/deepseek-chat`)
  - or use `routing.model_aliases` in `config.yaml` (e.g. `glm` → `zai/glm-4.5`)

When your request contains:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "X", "strict": true, "schema": { "...": "..." } }
  }
}
```

StructFormatter will:
- return `choices[0].message.content` as a JSON string that **validates against your schema**, or
- return HTTP **422** with a typed error payload (see `specs/api.md`).

## Config

Copy `config.example.yaml` and edit providers + routing:

- `providers.<name>.base_url`
- `providers.<name>.api_key_env`
- `providers.<name>.capabilities.json_object` (recommended when upstream supports JSON mode)
- `routing.model_aliases` (optional)

## Debugging

Optional request headers:
- `X-SF-Debug: 1` → include `__debug` field in the response
- `X-SF-Max-Attempts: 5` → override attempt budget for this request (1–10)

## Streaming

Per `specs/api.md` (v1):
- `stream=true` + `json_schema` → **400** (not supported)
- `stream=true` without `json_schema` → **SSE pass-through** to upstream

## Examples

```bash
bash examples/curl_schema_enforced.sh
python examples/python_openai_sdk_dropin.py
```
