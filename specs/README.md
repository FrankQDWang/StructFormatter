# StructFormatter — Specs

> Goal: provide **“A-like structured output”** for LLM APIs that **do not natively support JSON Schema-constrained decoding** (“A”), by building a **drop-in, external bridge** that implements a **robust “B” strategy**: *prompting + parsing + JSON repair + JSON Schema validation + deterministic fixes + re-ask loops*.

This repo is intentionally designed as an **external tool** (a sidecar/proxy). Your agent should not need code changes: it can keep calling an **OpenAI-compatible `/v1/chat/completions`** endpoint with `response_format: { type: "json_schema", ... }`, while StructFormatter takes care of enforcement behind the scenes.

---

## What’s inside `specs/`

- `native_A_guide.md`  
  A copyable guide for **how to use native structured outputs (A)** with **OpenAI / Anthropic / Gemini**.

- `requirements.md`  
  Product goals, non-goals, and acceptance criteria.

- `design.md`  
  Architecture, components, data flow, and performance considerations.

- `api.md`  
  OpenAI-compatible API contract and behavior.

- `algorithm.md`  
  The “B engine”: parsing/repair/validation/re-ask algorithm, retry policy, and prompts.

- `providers.md`  
  Provider adapter interface + initial adapters (DeepSeek, GLM/Z.ai, Kimi, generic OpenAI-compatible).

- `config.md`  
  Config file + routing rules.

- `testing.md`  
  Unit/integration/performance testing plan.

- `tasks.md`  
  A **step-by-step implementation plan** (Codex-friendly) with file-level deliverables.

---

## Definitions (A vs B)

- **A (native structured outputs)**: provider guarantees output matches a supplied JSON Schema via constrained decoding.
- **B (best-effort + enforcement loop)**: provider is not guaranteed; we enforce by:
  1) requesting JSON, 2) parsing/repairing, 3) validating, 4) fixing, 5) re-asking if needed.

---

## How Codex should use these specs

Start with `tasks.md` and implement in order.

When in doubt, the priority is:

1. **Correctness** (always return schema-valid JSON or a well-typed error)
2. **Drop-in compatibility** (OpenAI-shaped endpoint)
3. **Performance** (caching, minimal prompt bloat, bounded retries)
