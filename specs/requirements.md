# StructuredFormatter — Requirements

## 1. 中文摘要
我们要做一个**外部工具/桥接服务**：在不改动 Agent 代码的前提下，让 **不支持 A（JSON Schema 约束解码）** 的 LLM API 也能“像支持 A 一样”交付结构化 JSON ——通过 **B 策略**（JSON 模式/提示词 + 解析 + JSON repair + JSON Schema 校验 + deterministic fix + re-ask 重试）。

## 2. Problem statement
When building agents, non-A models often:
- waste context on “output format rules”
- still produce broken JSON or schema-mismatched output
- require multiple retries, increasing latency and cost

We want a drop-in component that:
- makes these models usable in structured pipelines
- remains provider-agnostic (DeepSeek / GLM / etc.)
- demonstrates engineering judgment (great for interviews)
- provides a low-cost fallback in your own agent project

## 3. Goals
G1. **Drop-in**: Agent code does not change. Only `base_url` (or endpoint) + `model` string changes.  
G2. **A-shaped contract**: If client requests `response_format.type = "json_schema"`, server returns:
- valid JSON
- **schema-valid** JSON (or a deterministic, typed error)
G3. **Multi-provider**: Support multiple upstream APIs, especially OpenAI-compatible ones.  
G4. **Lightweight & fast**: Minimal dependencies, high throughput, bounded retries.  
G5. **Open source friendly**: clean architecture, tests, good docs.

## 4. Non-goals (explicit)
NG1. We do **not** guarantee semantic correctness / factual correctness.  
NG2. We do **not** implement true constrained decoding for black-box remote APIs (that would be A).  
NG3. We do **not** aim to support every JSON Schema keyword perfectly (we validate using a standard validator, but prompt-side “understanding” is best-effort).  
NG4. We do **not** guarantee streaming for schema-enforced requests in v1 (optional later).

## 5. Target users & use cases
### U1. Agent developer (you)
- Wants native A for OpenAI/Anthropic/Gemini
- Wants a **backup** for DeepSeek/GLM/etc.
- Wants minimal integration effort: just change endpoint/model

### U2. OSS user
- Wants a “structured output proxy” that can enforce JSON schema via retries

### U3. Interviewer
- Evaluates ability to identify pain points and ship a pragmatic solution

## 6. Functional requirements
FR1. Provide OpenAI-compatible endpoint:
- `POST /v1/chat/completions`
- `GET /v1/models` (minimal)
(Optionally later: `/v1/responses`)

FR2. Accept and interpret:
- `response_format.type = "json_schema"` with embedded JSON Schema
- `response_format.type = "json_object"` (pass-through / best-effort)
- Regular free-form requests (pass-through)

FR3. For `json_schema` requests, enforce output:
- parse and extract JSON from model output
- attempt tolerant repair when JSON is invalid
- validate with JSON Schema
- apply deterministic fixes where safe
- if still invalid, re-ask model with validation errors
- bounded attempts (configurable)
- final outcome: schema-valid JSON or typed error

FR4. Multi-provider routing:
- parse `model` string as `provider/model` (or configurable)
- route to correct upstream base_url + auth key + model id

FR5. Observability:
- structured logs with request id
- expose per-request metadata: attempts, repair used, validation errors (optional debug mode)
- basic metrics (optional v1.1)

## 7. Non-functional requirements
NFR1. Performance
- schema compilation cached (LRU)
- keep-alive to upstream
- no unbounded memory growth
- protect against huge schemas (size limit)

NFR2. Reliability
- timeouts per attempt
- upstream errors mapped to OpenAI-like error format
- refusal / safety blocks mapped deterministically

NFR3. Security
- treat schema as untrusted input; limit recursion / size
- avoid logging sensitive content by default

## 8. Acceptance criteria
AC1. With a non-A model that supports only JSON mode, calling:
- `POST /v1/chat/completions` with `response_format.type="json_schema"`
returns schema-valid JSON in > 99% of normal cases under bounded retries.

AC2. With broken JSON outputs (missing quotes, trailing commas, code fences), the service repairs and validates successfully in the majority of cases (document expected failure modes).

AC3. Drop-in integration: OpenAI SDK can call this server by changing `base_url`.

AC4. Adding a new provider adapter takes < 50 LOC + config.

