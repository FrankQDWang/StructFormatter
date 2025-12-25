export type OpenAIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIChatMessage {
  role: OpenAIRole;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
}

export interface OpenAIResponseFormatJsonSchema {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
}

export interface OpenAIResponseFormatJsonObject {
  type: 'json_object';
}

export type OpenAIResponseFormat =
  | OpenAIResponseFormatJsonSchema
  | OpenAIResponseFormatJsonObject
  | { type: string; [k: string]: unknown };

export interface OpenAIChatCompletionsRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: OpenAIResponseFormat;
  tools?: unknown;
  tool_choice?: unknown;
  [k: string]: unknown;
}

export interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [k: string]: unknown;
}

export interface OpenAIChatCompletionsChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: unknown;
  };
  finish_reason: string | null;
}

export interface OpenAIChatCompletionsResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChatCompletionsChoice[];
  usage?: OpenAIUsage;
  [k: string]: unknown;
}

