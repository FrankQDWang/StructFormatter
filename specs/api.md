# StructuredFormatter — API (OpenAI-Compatible)

## 中文摘要
对外只暴露一个 OpenAI 形状的接口：`POST /v1/chat/completions`。当 `response_format.type=json_schema` 时，StructuredFormatter 承诺：**返回符合 schema 的 JSON**（或返回结构化错误），从而让 Agent 不用修改任何逻辑。

---

## 1) Endpoints

### 1.1 POST /v1/chat/completions
**Request (subset)**

```jsonc
{
  "model": "deepseek/deepseek-chat",
  "messages": [
    {"role":"system","content":"..."},
    {"role":"user","content":"..."}
  ],
  "temperature": 0.2,
  "max_tokens": 1024,
  "stream": false,

  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "Extract",
      "strict": true,
      "schema": { /* JSON Schema */ }
    }
  }
}
```

Notes:
- If `response_format` is omitted → pass-through (no enforcement).
- If `response_format.type="json_object"` → optional behavior:
  - prefer passing it upstream if supported
  - still run JSON repair if needed (best-effort)

### 1.2 GET /v1/models
Return configured model aliases in OpenAI format:
```json
{
  "object": "list",
  "data": [
    {"id":"deepseek/deepseek-chat","object":"model"},
    {"id":"zai/glm-4.5","object":"model"}
  ]
}
```

### 1.3 GET /healthz
Return 200 OK if server is running.

---

## 2) Behavior contract for `json_schema`

### 2.1 Success
Response must be OpenAI-shaped:
```jsonc
{
  "id": "chatcmpl_xxx",
  "object": "chat.completion",
  "created": 1730000000,
  "model": "deepseek/deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"foo\":123}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
}
```

- `choices[0].message.content` MUST be a JSON string that:
  - parses successfully
  - validates against provided schema

### 2.2 Failure
If after `max_attempts` output is still invalid, return:

- HTTP 422 (recommended)
- payload:

```json
{
  "error": {
    "type": "structured_output_failed",
    "message": "Failed to produce schema-valid JSON after 3 attempts",
    "details": {
      "attempts": 3,
      "last_candidate_excerpt": "{ ... }",
      "validation_errors": [
        {"path":"/age","message":"must be integer"}
      ]
    }
  }
}
```

### 2.3 Timeouts and upstream errors
Map upstream network/timeouts to:
- HTTP 502/504 (proxy-style)
- OpenAI-like error object

---

## 3) Optional headers / debug mode (recommended)
For interview/demo purposes, add optional headers:

- `X-SF-Debug: 1`
  - include debug metadata in response under `__debug` (non-OpenAI field) **ONLY when enabled**.

- `X-SF-Max-Attempts: 5`
  - override per-request attempt budget.

Default: no debug fields; strict OpenAI compatibility.

---

## 4) Streaming policy (v1)
- If `stream=true` AND `response_format.type="json_schema"`:
  - v1 behavior: return 400 with message “streaming not supported for schema-enforced requests”
  - (future) support SSE streaming once “valid fragment” streaming validation is implemented.

