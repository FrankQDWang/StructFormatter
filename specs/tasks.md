# StructuredFormatter — Tasks (Codex execution plan)

> Goal: Codex should be able to “just follow this file” and implement end-to-end.

## 0) Repository bootstrap
- [ ] Initialize Node.js project (Node 20+)
- [ ] TypeScript + ESLint + Prettier
- [ ] Package manager: pnpm (recommended) or npm
- [ ] Add minimal CI workflow (lint + test)

**Deliverables**
- `package.json`, `tsconfig.json`, `.eslintrc`, `.prettierrc`
- `src/` directory scaffold

---

## 1) Define core types (OpenAI-shaped)
- [ ] Create `src/types/openai.ts`
  - request/response types for `/v1/chat/completions`
  - include `response_format` shapes

- [ ] Create `src/types/internal.ts`
  - `ProviderAdapter`, `RequestContext`
  - `EnforcementPolicy`
  - `StructuredResult`, `StructuredError`

**Acceptance**
- Types compile and are used by other modules.

---

## 2) Config system
- [ ] Create `src/config/schema.ts` (config typing)
- [ ] Create `src/config/load.ts`
  - load YAML/JSON
  - env var overrides
  - validate config shape

**Acceptance**
- `STRUCTUREDFORMATTER_CONFIG=...` loads config and prints a summary on startup.

---

## 3) Provider adapters
### 3.1 Generic OpenAI-compatible adapter
- [ ] `src/providers/openai_compatible.ts`
  - implement `chatCompletions()`
  - use `undici` fetch + keep-alive
  - inject Authorization header
  - support `drop_params` config

### 3.2 Provider registry
- [ ] `src/providers/index.ts`
  - instantiate adapters from config
  - expose `getAdapter(providerName)`

**Acceptance**
- A mocked upstream can be called successfully.

---

## 4) Schema validation layer (Ajv)
- [ ] Add Ajv dependency
- [ ] `src/validate/ajv.ts`
  - create Ajv instance with safe options
  - support draft selection (default 2020-12)
- [ ] `src/validate/cache.ts`
  - LRU cache keyed by schema hash
  - compile schema to validation function
- [ ] `src/validate/errors.ts`
  - summarize Ajv errors into compact list

**Acceptance**
- Given schema + object, returns valid/errors quickly.
- Cache hit works.

---

## 5) JSON extraction & repair
- [ ] Add `jsonrepair` dependency
- [ ] `src/json/extract.ts`
  - strip fences
  - extract JSON substring
- [ ] `src/json/parse.ts`
  - JSON.parse
  - fallback to jsonrepair + parse
  - return `{ok, value, error}`

**Acceptance**
- Unit tests cover typical malformed outputs.

---

## 6) Deterministic patcher (safe subset)
- [ ] `src/patch/patch.ts`
  - remove additional properties
  - primitive coercions (optional, configurable)
- [ ] Keep patching conservative.

**Acceptance**
- Patch improves validation in mechanical cases; never adds unknown keys.

---

## 7) Prompt builder (minimize tokens)
- [ ] `src/prompt/sanitize_schema.ts`
  - remove non-validation keywords
- [ ] `src/prompt/templates.ts`
  - first attempt template
  - re-ask template with errors
- [ ] `src/prompt/build.ts`
  - merges original messages + instructions

**Acceptance**
- Prompts are short and deterministic.

---

## 8) Structured Enforcement Engine (B Engine)
- [ ] `src/enforce/engine.ts`
  - implement attempt loop from `algorithm.md`
  - call provider
  - parse/repair
  - validate
  - patch
  - re-ask
  - aggregate usage when possible
- [ ] `src/enforce/errors.ts`
  - structured error objects
- [ ] Ensure bounded attempts and per-attempt timeouts.

**Acceptance**
- With mocked upstream returning invalid outputs then corrected output, engine returns schema-valid JSON.

---

## 9) HTTP server (Fastify)
- [ ] `src/server.ts`
  - create Fastify instance
  - `/healthz`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
- [ ] Request handler flow:
  1. normalize request
  2. route provider/model
  3. if response_format=json_schema → enforce via engine
  4. else → pass-through to provider
  5. shape response OpenAI-style
- [ ] Debug mode headers (optional, per `api.md`)

**Acceptance**
- OpenAI SDK can call it by base_url change only.

---

## 10) Tests
- [ ] Add test runner (vitest or jest)
- [ ] Unit tests for:
  - extraction
  - parse/repair
  - validation
  - patch
- [ ] Integration test:
  - start server
  - start mock upstream
  - run schema-enforced request, assert valid JSON

**Acceptance**
- `pnpm test` passes in CI.

---

## 11) OSS hygiene
- [ ] `LICENSE` (MIT)
- [ ] `SECURITY.md`
- [ ] `CONTRIBUTING.md`
- [ ] `README` (outside specs) is optional — but keep `specs/` as the source of truth for Codex.

---

## 12) Demo scripts (for interview)
- [ ] `examples/`:
  - `python_openai_sdk_dropin.py`
  - `curl_schema_enforced.sh`
- [ ] show before/after: upstream broken JSON → StructuredFormatter returns clean schema-valid JSON.

---

## Definition of Done
- Server runs locally with config
- Works as OpenAI SDK base_url drop-in
- Enforces schema for non-A upstreams via B loop
- Bounded retries, clear errors, tests included

