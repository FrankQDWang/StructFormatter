import os

from openai import OpenAI


def main() -> None:
    client = OpenAI(
        base_url=os.environ.get("SF_BASE_URL", "http://localhost:18081/v1"),
        api_key="anything",
    )

    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["answer"],
        "properties": {"answer": {"type": "string"}},
    }

    resp = client.chat.completions.create(
        model=os.environ.get("SF_MODEL", "deepseek/deepseek-chat"),
        messages=[{"role": "user", "content": "Say hello in one sentence."}],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "T", "strict": True, "schema": schema},
        },
    )
    print(resp.choices[0].message.content)


if __name__ == "__main__":
    main()
