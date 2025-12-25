# StructuredFormatter — Providers & Adapters

## 中文摘要
优先做一个“通用 OpenAI-compatible 适配器”，覆盖 DeepSeek / GLM(Z.ai) / Kimi 等大量上游；再做少量 provider-specific quirks（比如 DeepSeek strict tools 需要 beta base_url）。

---

## 1) Adapter interface

```ts
export interface ProviderAdapter {
  name: string;
  supports: {
    json_object?: boolean;      // response_format: {type:"json_object"}
    tools?: boolean;            // tools/tool_choice supported
    strict_tools?: boolean;     // provider validates tool args against schema
  };

  chatCompletions(req: OpenAIChatCompletionsRequest, ctx: RequestContext): Promise<OpenAIChatCompletionsResponse>;
}
```

### 1.1 RequestContext
Includes:
- request id
- timeout
- upstream api key
- base_url
- model mapping

---

## 2) Built-in adapters (v1)

### 2.1 `openai_compatible`
Most practical: many vendors expose OpenAI-compatible `/v1/chat/completions`.

Config fields:
- `base_url`
- `api_key_env`
- `default_headers`
- `capabilities` (json_object/tools/strict_tools)
- `drop_params` (list of request params to remove for upstream compatibility)

Why drop params?
Some OpenAI-compatible providers reject certain OpenAI params (observed in the ecosystem), so we allow per-provider “drop or rewrite”.

### 2.2 DeepSeek (as OpenAI-compatible + quirks)
DeepSeek docs show JSON mode:
- set `response_format: {"type":"json_object"}`
- prompt should include the word “json”
- set max_tokens to avoid truncation
https://api-docs.deepseek.com/guides/json_mode

DeepSeek strict tool calls (beta):
- requires beta base_url
- tool definitions need `strict: true`
https://api-docs.deepseek.com/guides/tool_calls

In v1: treat DeepSeek as openai_compatible and enable `json_object` if configured.  
Optional v1.1: tool-call-first strategy when strict_tools enabled.

### 2.3 GLM / Z.ai
Z.ai docs describe “structured output” by `response_format={"type":"json_object"}` for supported models (e.g., glm-4.5, glm-4.6).  
https://docs.z.ai/guides/capabilities/struct-output

Treat as openai_compatible if endpoint matches.

### 2.4 Moonshot (Kimi)
Moonshot API docs: `response_format={"type":"json_object"}` enables JSON mode.  
https://platform.moonshot.ai/docs/api/chat

Treat as openai_compatible.

---

## 3) Adding a new provider
Steps:
1. Add provider config block in `config.yaml`
2. If it is OpenAI-compatible:
   - use `openai_compatible` adapter
   - set `base_url`, `api_key_env`, capability flags
3. If it is not OpenAI-compatible:
   - implement a new adapter that maps to OpenAI request/response format

Acceptance: new adapter added without modifying B engine.

