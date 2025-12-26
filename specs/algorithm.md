# StructFormatter — Algorithm (B Engine)

## 中文摘要
B 的核心：**先尽量用上游的 JSON Mode / tool calls 降低错误率，再用本地 JSON repair + schema 校验兜底，最后用 re-ask 把错误闭环**。最终对 Agent 暴露一个“像 A 一样”的语义：要么返回 schema-valid JSON，要么返回结构化错误。

---

## 1) Inputs / Outputs

### Inputs
- `messages`: OpenAI chat messages
- `schema`: JSON Schema object (from `response_format.json_schema.schema`)
- `provider`: resolved provider adapter
- `policy`:
  - `max_attempts`
  - `timeout_ms_per_attempt`
  - `enable_deterministic_fix`
  - `enable_jsonrepair`

### Output
- Success: `{ ok: true, json: object, jsonText: string, usage: UsageAgg, attempts: AttemptTrace[] }`
- Failure: `{ ok: false, error: StructuredOutputError, attempts: AttemptTrace[] }`

---

## 2) Core loop

### 2.1 Pseudocode

```ts
for attempt in 1..max_attempts:
  req = buildUpstreamRequest(attempt, messages, schema, lastCandidate, lastErrors)

  upstreamResp = provider.chatCompletions(req)

  candidateTextOrTool = extractCandidate(upstreamResp)

  candidateObj = tryParseCandidate(candidateTextOrTool)
    - extract JSON substring
    - JSON.parse
    - jsonrepair + parse

  if candidateObj is null:
     lastErrors = [ {kind:"parse_error", message:"..."} ]
     continue  // re-ask

  // validate
  valid, errors = validate(schema, candidateObj)
  if valid:
     return success(candidateObj)

  // deterministic patch
  if enable_deterministic_fix:
     patched = patch(schema, candidateObj, errors)
     valid2, errors2 = validate(schema, patched)
     if valid2:
        return success(patched)
     errors = errors2
     candidateObj = patched

  lastCandidate = candidateObj
  lastErrors = errors

return failure(lastCandidate, lastErrors)
```

---

## 3) Build prompts (minimize context)

### 3.1 Schema sanitization
Before inserting schema into prompts:
- remove: `title`, `description`, `examples`, `default`, `deprecated`, `readOnly`, `writeOnly`
- keep: `type`, `properties`, `required`, `items`, `enum`, `anyOf/oneOf/allOf`, `$ref` (optional)

Goal: fewer tokens, less noise.

### 3.2 First attempt prompt template
System (prepend, minimal):
```
You MUST output ONLY valid JSON (no markdown, no code fences, no explanation).
The JSON MUST conform to the following JSON Schema:
<SCHEMA_JSON>
```

User: original user messages stay unchanged.

Upstream knobs:
- If upstream supports JSON mode (`response_format.type=json_object`) enable it to reduce syntax errors.
  DeepSeek docs explicitly require setting response_format and mentioning “json” in the prompt.  
  https://api-docs.deepseek.com/guides/json_mode

### 3.3 Repair attempt prompt (after failure)
System:
```
You previously returned JSON that failed validation.

Return ONLY corrected JSON that conforms to the schema.
Do NOT add any keys not present in schema.
Do NOT include markdown.
```

Assistant (as context):
- include lastCandidate JSON (compact)
- include validation errors list:
  - `path`, `expected`, `actual`, `message`

---

## 4) JSON extraction & repair

### 4.1 Extract JSON substring
Handle common patterns:
- fenced code blocks ```json ... ```
- prefix/suffix text: “Here is the JSON:”
Algorithm:
1. strip code fences
2. find first `{` and last `}`; if not found, try `[` and `]`
3. take substring; trim

### 4.2 Repair invalid JSON
Use `jsonrepair` (npm) if JSON.parse fails.
The `jsonrepair` package is designed to repair invalid JSON and mentions streaming support.  
https://www.npmjs.com/package/jsonrepair

Fallback: if repair fails, treat as parse_error and re-ask.

---

## 5) Validation (Ajv) & error summarization

Use Ajv compiled validator.

Ajv compiles schema into efficient functions and supports multiple JSON Schema drafts.  
https://ajv.js.org/

Error summarization:
- Ajv errors include `instancePath`, `message`, `params`
Convert into compact lines:
- `/path`: `message` + minimal expected info

---

## 6) Deterministic patching (safe subset)

### 6.1 Goals
- Fix mechanical issues without guessing semantic values.

### 6.2 Allowed patches (v1)
- Remove additional properties (if disallowed)
- Coerce primitive types (lossless) e.g.
  - "42" -> 42 when integer expected
  - "true"/"false" -> boolean
- Wrap scalar into single-item array if schema expects array (optional)

### 6.3 Not allowed (v1)
- Inventing missing required values
- Choosing enum value heuristically
- Complex structural transformations

If missing required fields → re-ask.

---

## 7) Attempt budgeting & cost control
- default `max_attempts = 3`
- treat refusal/safety blocks as non-retriable
- optional: per-provider overrides

---

## 8) Notes about “tool strict mode” (bonus)
Some providers (e.g., DeepSeek) offer **strict tool call mode** where tool call args must match function schema.  
DeepSeek docs: strict mode is beta and requires their beta base_url and `strict: true` in tools.  
- https://api-docs.deepseek.com/guides/tool_calls

We can optionally implement a “tool-call first” strategy when supported.
