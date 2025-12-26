# StructFormatter — Testing Plan

## 中文摘要
测试要覆盖：JSON 抽取/修复、schema 校验、re-ask 闭环、OpenAI 兼容性（SDK 调用不改代码）、以及性能基准。

---

## 1) Unit tests

### 1.1 JSON extraction
Cases:
- raw JSON
- fenced JSON ```json ... ```
- prefix/suffix text
- multiple JSON blocks → choose the best one

### 1.2 JSON repair
- missing quotes
- trailing commas
- single quotes
- broken brackets

Expectation:
- jsonrepair converts to valid JSON or returns error deterministically.

### 1.3 Schema validation
- basic types, required, additionalProperties=false
- enums
- arrays/items
- nested objects

### 1.4 Deterministic patch
- remove extra props
- coerce types
- ensure patch does not introduce new keys

---

## 2) Integration tests (mock upstream)

Implement a fake upstream provider server:
- returns:
  1) invalid JSON (first call)
  2) valid JSON but schema-invalid (second call)
  3) schema-valid JSON (third call)

Verify StructFormatter:
- performs repair then re-ask as needed
- returns final schema-valid output

---

## 3) Compatibility tests

### 3.1 OpenAI SDK drop-in
Use OpenAI Python/JS SDK pointing base_url at StructFormatter and run:
- normal free-form call (pass-through)
- schema-enforced call

---

## 4) Performance tests

### 4.1 Local benchmark
- 100 concurrent requests
- small schema
- upstream mocked with fixed latency

Measure:
- p50/p95 latency
- throughput
- CPU usage
- memory growth

### 4.2 Cache effectiveness
- repeated calls with identical schema should reuse Ajv compiled validator (hit rate > 95%)

---

## 5) Regression corpus
Create a `fixtures/` directory (Codex will add) with:
- sample prompts
- broken JSON outputs
- expected fixed outputs (golden)

Run in CI.
