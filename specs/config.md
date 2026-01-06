# StructFormatter — Configuration

## 中文摘要
配置分两块：`providers`（上游端点与能力）+ `routing`（model 字符串怎么映射到 provider + upstream model）。

---

## 1) Config file
Use `config.yaml` (recommended) or `config.json`.

### 1.1 Example `config.yaml`

```yaml
server:
  host: 0.0.0.0
  port: 18081
  request_body_limit_mb: 2

enforcement:
  max_attempts: 3
  timeout_ms_per_attempt: 20000
  enable_jsonrepair: true
  enable_deterministic_fix: true
  schema_max_bytes: 200000

routing:
  # default: model string is "provider/model"
  mode: provider_prefix
  model_aliases:
    glm: "zai/glm-4.5"
    ds: "deepseek/deepseek-chat"

providers:
  deepseek:
    type: openai_compatible
    base_url: "https://api.deepseek.com"
    api_key_env: "DEEPSEEK_API_KEY"
    capabilities:
      json_object: true
      tools: true
      strict_tools: true
    # optional: strict tool mode uses beta base url
    beta_base_url: "https://api.deepseek.com/beta"

  zai:
    type: openai_compatible
    base_url: "https://api.z.ai/api/paas/v4"
    api_key_env: "ZAI_API_KEY"
    capabilities:
      json_object: true

  moonshot:
    type: openai_compatible
    base_url: "https://api.moonshot.cn/v1"
    api_key_env: "MOONSHOT_API_KEY"
    capabilities:
      json_object: true
```

---

## 2) Environment variables

- `STRUCTFORMATTER_CONFIG`: path to config yaml/json
- `DEEPSEEK_API_KEY`, `ZAI_API_KEY`, `MOONSHOT_API_KEY`, ...

---

## 3) Routing rules

### 3.1 provider_prefix mode
- `model="deepseek/deepseek-chat"` → provider `deepseek`, upstream model `deepseek-chat`
- `model="glm"` → alias `zai/glm-4.5`

### 3.2 future: explicit route table
Optional later:
```yaml
routing:
  mode: table
  table:
    - match: "^deepseek-.*"
      provider: deepseek
      upstream_model: "deepseek-chat"
```

---

## 4) Safety limits
- `schema_max_bytes`: reject too-large schemas with 400
- request body size limit (Fastify) to avoid memory issues
