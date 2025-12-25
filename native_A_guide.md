# 原生 A：OpenAI / Anthropic / Gemini 结构化输出使用指南（可复制版）

> 目标：在 Agent 项目中**原生使用 A（JSON Schema 约束输出）**，减少 prompt 里“格式说明”的上下文占用，并降低重试概率。

本文是“可复制”的版本（方便你直接保存到项目里）。

---

## 统一心智模型

- **A（Structured Outputs / Structured output）**：你提供 JSON Schema，模型输出**保证**符合 schema（字段/类型/枚举/必填/是否允许额外字段）。
- **JSON Mode（`json_object`）**：只保证输出是 **valid JSON**，但**不保证**符合 schema（属于 B）。

---

## OpenAI（Structured Outputs）

官方文档与指南：

- Structured outputs guide: https://platform.openai.com/docs/guides/structured-outputs  
- Responses API 中 structured outputs 形状说明（`text.format`）：https://platform.openai.com/docs/guides/migrate-to-responses  

### 1) Chat Completions：`response_format: json_schema`

请求里传：

```json
"response_format": {
  "type": "json_schema",
  "json_schema": {
    "name": "MySchemaName",
    "schema": { "...": "..." },
    "strict": true
  }
}
```

> 注意：不同 SDK/版本字段名可能略不同，但核心是 `type=json_schema + schema + strict=true`。

**常见坑（OpenAI strict=true 时）**

- 所有 object 必须 `additionalProperties: false`
- 所有字段都必须出现在 `required`
- “可选字段”建议改成 `type: ["string","null"]` 这类 union-with-null（字段依然返回，但允许为 null）

（这些是 OpenAI Structured Outputs 的常见限制/行为，详见官方文档。）

### 2) Responses API：`text.format: json_schema`

Responses API 不用 `response_format`，而是在 `text.format` 里放：

```json
"text": {
  "format": {
    "type": "json_schema",
    "name": "extract",
    "strict": true,
    "schema": { "...": "..." }
  }
}
```

### 3) 运行时必须处理的两类分支

- **incomplete**：输出被截断（例如 max_output_tokens 不够）
- **refusal**：被策略拒绝

你的代码里要把它们当成正常分支处理（提高上限/重试/返回结构化错误）。

---

## Anthropic Claude（Structured Outputs - Public Beta）

官方文档：

- https://platform.claude.com/docs/en/build-with-claude/structured-outputs

### 1) JSON outputs（控制“最终回复 JSON”）

关键点：

1. `output_format: { type: "json_schema", schema: {...} }`
2. 必须带 beta：`anthropic-beta: structured-outputs-2025-11-13`（或 SDK 的 `betas=[...]`）

SDK 推荐用 `client.beta.messages.parse()`，它会返回 `parsed_output`（已校验）。

### 2) Strict tool use（控制“工具入参 JSON”）

如果你是 Agent 工作流，通常更推荐“把结构化交付变成 tool input”：

- 在 tool 定义顶层加：`strict: true`
- 提供 `input_schema`

### 3) Claude 侧的工程注意事项

- schema 首次使用需要 grammar 编译；编译产物会缓存（文档里说明了缓存与失效条件）
- `stop_reason=refusal` 或 `max_tokens` 时可能导致不符合 schema，需要分支处理
- schema 太复杂可能 400，需要简化

---

## Gemini（Structured Outputs）

官方文档：

- https://ai.google.dev/gemini-api/docs/structured-output

### 1) 怎么用

Gemini 的结构化输出通过 config 开启：

- `responseMimeType: "application/json"`
- `responseJsonSchema: <JSON Schema>`

（Python/TS SDK 字段名大小写略不同，但语义一致。）

### 2) 注意事项

- JSON Schema 是子集：不支持的关键字可能被忽略；schema 太大/太深可能被拒绝
- 输出 key 顺序会跟随 schema key 顺序（文档明确说明）
- 需要处理 safety block（例如 prompt 被 block / finishReason=SAFETY）

---

## 跨三家通用建议（强烈推荐）

1. **Schema 尽量“小、浅、稳定”**  
   复杂 schema 会带来：更高 token 成本、更容易触发限制/拒绝、更难 debug。

2. **可选字段统一做成 “字段存在但允许 null”**  
   这样最利于跨厂商一致性，也减少“缺字段”带来的业务分支。

3. **永远保留本地校验**  
   A 大幅降低格式错误，但不代表语义正确；并且 refusal / 截断仍会发生。

---

## 参考实现思路（你项目里怎么统一封装）

建议做一个 `StructuredLLMClient`，对外只暴露：

```ts
generate<T>(provider: "openai"|"anthropic"|"gemini", model: string, messages: ..., schema: JSONSchema): Promise<T>
```

内部按 provider 映射：
- OpenAI: `response_format` 或 `text.format`
- Anthropic: `output_format` + beta header
- Gemini: `responseMimeType` + `responseJsonSchema`

并统一处理 refusal/incomplete/safety。

---

## 参考链接

- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- Anthropic Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Gemini Structured Outputs: https://ai.google.dev/gemini-api/docs/structured-output
