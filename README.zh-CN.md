# StructFormatter

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/lang-English-blue.svg" alt="English"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/lang-简体中文-red.svg" alt="简体中文"></a>
</p>

<p align="center">
  <a href="https://github.com/FrankQDWang/StructFormatter/actions/workflows/ci.yml"><img src="https://github.com/FrankQDWang/StructFormatter/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/structformatter"><img src="https://img.shields.io/npm/v/structformatter" alt="npm"></a>
</p>

StructFormatter 是一个 **OpenAI 兼容的代理服务（sidecar/proxy）**：让**不支持原生 JSON Schema 约束解码（A）** 的上游模型，也能“像支持 A 一样”返回结构化 JSON。

它用一套稳健的 **B 策略闭环** 来强制输出满足 schema：
提示词 → JSON 抽取 → JSON 修复（jsonrepair）→ JSON Schema 校验（Ajv）→ 机械修补 → 带错误信息 re-ask 重试。

`specs/` 目录是项目的设计与验收来源（架构、API 合约、算法、测试计划、任务清单）。

## 适用场景

很多厂商只提供 “JSON mode”（保证输出是合法 JSON），但**不保证**符合你提供的 JSON Schema。

如果你的 agent 流程强依赖结构化输出，StructFormatter 可以作为一个“外置桥接服务”，让你的 agent **基本不用改逻辑**，只改 `base_url` 即可。

## 快速开始（源码运行）

```bash
pnpm install
cp config.example.yaml config.yaml
export STRUCTFORMATTER_CONFIG=./config.yaml
pnpm dev
```

对外接口：
- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

## 快速开始（npm）

```bash
pnpm dlx structformatter --config ./config.yaml
```

或：

```bash
npx structformatter --config ./config.yaml
```

## 如何嵌入现有 agent（Drop-in）

把 OpenAI SDK 的 `base_url` 指向本服务：

- Base URL：`http://localhost:8080/v1`
- `model` 命名：`provider/model`（例如 `deepseek/deepseek-chat`）
  - 或者在 `config.yaml` 里用 `routing.model_aliases` 做别名映射

当你的请求包含：

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "X", "strict": true, "schema": { "...": "..." } }
  }
}
```

StructFormatter 会承诺：
- 成功：`choices[0].message.content` 是**可解析且符合 schema 的 JSON 字符串**
- 失败：HTTP **422** + 结构化错误（见 `specs/api.md`）

## 配置说明

建议从 `config.example.yaml` 复制一份：

- `providers.<name>.base_url`：上游 OpenAI-compatible 地址
- `providers.<name>.api_key_env`：从环境变量读取 key（避免写死在文件里）
- `providers.<name>.capabilities.json_object`：上游支持 JSON mode 时建议开启
- `routing.model_aliases`：可选别名映射（如 `glm` → `zai/glm-4.5`）

## 调试与可观测性

可选请求头：
- `X-SF-Debug: 1` → 响应中包含 `__debug`
- `X-SF-Max-Attempts: 5` → 覆盖本次请求的最大重试次数（1–10）

## Streaming（v1 规则）

严格遵循 `specs/api.md`：
- `stream=true` 且 `json_schema` → **400**（v1 不支持）
- `stream=true` 且非 `json_schema` → **SSE 透传上游**

## 示例

```bash
bash examples/curl_schema_enforced.sh
python examples/python_openai_sdk_dropin.py
```
