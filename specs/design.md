# StructuredFormatter — Design

## 中文摘要
整体架构：**OpenAI-compatible Proxy + Structured Enforcement Engine**。对外提供 `/v1/chat/completions`，对内支持多 provider 路由；当请求包含 `response_format: json_schema` 时，走 **B 强制链路**：调用上游 → JSON 抽取/修复 → Ajv 校验 → deterministic fix → re-ask（带错误信息）→ 直到成功或失败。

---

## 1. Architecture overview

### 1.1 High-level components
1) **HTTP Server (Fastify)**
- OpenAI-compatible endpoints
- request normalization
- response shaping

2) **Router**
- resolves provider + upstream model from `model` string and config

3) **Provider adapters**
- generic OpenAI-compatible adapter (covers DeepSeek, GLM/Z.ai, Kimi, etc. if they expose OpenAI-like endpoints)
- optional provider-specific adapters for quirks

4) **Structured Enforcement Engine (B Engine)**
- prompt builder
- call/attempt loop
- JSON extraction + repair
- JSON Schema validation (Ajv)
- deterministic patching
- re-ask with validation errors
- attempt budgeting + timeouts

5) **Schema registry + validator cache**
- schema fingerprint (stable hash)
- Ajv compile cache (LRU)

6) **Observability**
- request id
- debug traces (off by default)

---

## 2. Tech choices (why)

### 2.1 Language/runtime
**TypeScript (Node.js 20+)**: great ecosystem for JSON Schema + HTTP proxy, easy OSS adoption.

### 2.2 HTTP server
**Fastify** for performance and low overhead.

### 2.3 JSON Schema validation
**Ajv**: compiles schemas into fast validation functions (good for high throughput).  
References: Ajv docs and npm mention codegen speed.  
- https://ajv.js.org/  
- https://www.npmjs.com/package/ajv

### 2.4 JSON repair
Use `jsonrepair` (or compatible) to fix malformed JSON from LLM outputs.
- The npm `jsonrepair` package explicitly targets repairing invalid JSON and mentions streaming support.
  https://www.npmjs.com/package/jsonrepair

Fallback: implement a minimal “extract JSON substring” even without repair, but keep `jsonrepair` as default.

---

## 3. API surface (external)

### 3.1 Endpoints
- `POST /v1/chat/completions` (required)
- `GET /v1/models` (required minimal; return configured models)
- `/healthz` (recommended)

### 3.2 Drop-in compatibility
Agent should be able to do:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8080/v1", api_key="anything")
client.chat.completions.create(...)
```

---

## 4. Request normalization

### 4.1 Supported request shapes
We accept OpenAI-shaped chat completion payload. Key fields:
- `model`, `messages`, `temperature`, `top_p`, `max_tokens`, `stream`
- `response_format`

We mainly care about:
- `response_format.type == "json_schema"`
- (optional) `response_format.type == "json_object"`

If no `response_format`, pass-through to upstream.

### 4.2 `response_format` variations
Some SDKs use:
- chat completions: `response_format: {type:"json_schema", json_schema:{name,schema,strict}}`
Others may send:
- responses-style: `text.format` (optional future support)
We support chat completions first; responses can be added later.

---

## 5. Provider routing

### 5.1 Model naming convention
Default: `provider/model` e.g.
- `deepseek/deepseek-chat`
- `zai/glm-4.5`
- `moonshot/kimi-k2`

Router parses prefix before first `/`:
- provider = prefix
- upstream_model = rest

Config can map aliases:
- `model_aliases: { "glm": "zai/glm-4.5" }`

### 5.2 Auth
Each provider config defines `api_key_env` and optional headers mapping.

---

## 6. B Engine (Structured Enforcement)

### 6.1 Attempt loop
Pseudo-flow:

1) Build first attempt prompt:
- minimal system instruction: “Return JSON only.”
- include schema (sanitized) as plain JSON (no markdown)
- optionally include an example shape (optional)
- for providers that support JSON mode, enable it upstream (`response_format: {type:"json_object"}`) to reduce syntax errors

2) Call upstream provider.

3) Parse candidate:
- if tool call output exists and is parseable → candidate object
- else candidate string from assistant message

4) Extract JSON substring:
- remove code fences
- locate first `{` and last `}` (or `[` and `]`)
- prefer the largest valid-looking JSON block

5) Parse:
- try `JSON.parse`
- if fails, run `jsonrepair` then parse again

6) Validate against schema (Ajv).
- If valid: return.

7) Deterministic patch (safe fixes) then re-validate:
- remove additional properties if `additionalProperties=false`
- coerce obvious types (string->number, string->boolean) if enabled
- fill missing properties with defaults if schema provides `default` (optional)
If valid: return.

8) Re-ask:
- build a correction prompt with:
  - previous candidate JSON
  - a compact list of validation errors (paths + expected)
  - “Return corrected JSON only. No prose. No code fences.”
- call upstream again.
- repeat until `max_attempts`.

9) If still invalid: return an OpenAI-like error payload.

### 6.2 Retry policy
- default `max_attempts`: 3 (configurable)
- backoff: none by default (keep low latency)
- stop early if upstream returns refusal / safety block

### 6.3 Minimizing context overhead
- **sanitize schema** before sending to LLM:
  - remove `title`, `description`, `examples`
  - keep `type`, `properties`, `required`, `enum`, `items`, `oneOf/anyOf` if needed
- send **only** the compact schema, not long explanations

---

## 7. Deterministic patching rules (v1 safe subset)
Goal: fix “mechanical” mismatches without changing semantics.

Allowed patches:
- remove extra keys when schema disallows them
- coerce primitive types when lossless (e.g., `"42"` -> 42)
- wrap scalar into array if schema expects array with single item (optional)
- if missing required fields:
  - do NOT guess values
  - prefer re-ask

---

## 8. Error handling & response shaping

### 8.1 Return shape
Return OpenAI chat completion format with:
- `choices[0].message.content` containing the final JSON string (not pretty-printed)
- `usage` aggregated across attempts when possible

### 8.2 OpenAI-like error
If schema enforcement fails:
- HTTP 422 (recommended) or 400
- payload:
```json
{
  "error": {
    "type": "structured_output_failed",
    "message": "Failed to produce schema-valid JSON after N attempts",
    "details": { "validation_errors": [...] }
  }
}
```

---

## 9. Performance notes
- Ajv validators are cached by schema hash.
- keep-alive HTTP agent to upstream (undici)
- cap request body size and schema size
- optional: streaming disabled for schema-enforced requests in v1 (simplify correctness)

---

## 10. Future extensions (not in v1)
- SSE streaming with “valid fragment” validation (similar to how Guardrails discusses streaming validation conceptually)
- fallback to a cheap A-capable formatter model (optional)
- tool-call passthrough and strict tool emulation
