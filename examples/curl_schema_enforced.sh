#!/usr/bin/env bash
set -euo pipefail

curl -sS http://localhost:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'X-SF-Debug: 1' \
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [{"role":"user","content":"Return a person object."}],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "Person",
        "strict": true,
        "schema": {
          "type": "object",
          "additionalProperties": false,
          "required": ["name","age"],
          "properties": {
            "name": {"type":"string"},
            "age": {"type":"integer"}
          }
        }
      }
    }
  }' | python -m json.tool

