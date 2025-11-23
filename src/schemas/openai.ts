import { z } from "zod";

// Chat Completions Request Schema
export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "function", "tool"]),
  content: z.string().nullable(),
  name: z.string().optional(),
  function_call: z
    .object({
      name: z.string(),
      arguments: z.string(),
    })
    .optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
});

export const ChatCompletionsRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  logit_bias: z.record(z.string(), z.number()).optional(),
  user: z.string().optional(),
  functions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        parameters: z.record(z.string(), z.any()).optional(),
      })
    )
    .optional(),
  function_call: z
    .union([
      z.literal("none"),
      z.literal("auto"),
      z.object({
        name: z.string(),
      }),
    ])
    .optional(),
  tools: z
    .array(
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.string(), z.any()).optional(),
        }),
      })
    )
    .optional(),
  tool_choice: z
    .union([
      z.literal("none"),
      z.literal("auto"),
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
        }),
      }),
    ])
    .optional(),
});

// Chat Completions Response Schema
export const ChatChoiceSchema = z.object({
  index: z.number().int(),
  message: ChatMessageSchema,
  finish_reason: z.preprocess((val) => {
    // Convert to lowercase if it's a string, otherwise return as-is (for null)
    if (typeof val === "string") {
      return val.toLowerCase();
    }
    return val;
  }, z.enum(["stop", "length", "function_call", "tool_calls", "content_filter"]).nullable()),
});

export const UsageSchema = z.object({
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  total_tokens: z.number().int(),
});

export const ChatCompletionsResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion"),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(ChatChoiceSchema),
  usage: UsageSchema,
});

// Models Response Schema
export const ModelSchema = z.object({
  id: z.string(),
  object: z.literal("model"),
  created: z.number().int(),
  owned_by: z.string(),
  permission: z
    .array(
      z.object({
        id: z.string(),
        object: z.literal("model_permission"),
        created: z.number().int(),
        allow_create_engine: z.boolean(),
        allow_sampling: z.boolean(),
        allow_logprobs: z.boolean(),
        allow_search_indices: z.boolean(),
        allow_view: z.boolean(),
        allow_fine_tuning: z.boolean(),
        organization: z.string(),
        group: z.string().nullable(),
        is_blocking: z.boolean(),
      })
    )
    .optional(),
  root: z.string().optional(),
  parent: z.string().optional().nullable(),
});

export const ModelsListResponseSchema = z.object({
  object: z.literal("list"),
  data: z.array(ModelSchema),
});

// OpenAI Error Response Schema
export const OpenAIErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.string().nullable().optional(),
    code: z.string().nullable().optional(),
  }),
});

// Type exports for TypeScript
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatCompletionsRequest = z.infer<
  typeof ChatCompletionsRequestSchema
>;
export type ChatCompletionsResponse = z.infer<
  typeof ChatCompletionsResponseSchema
>;
export type ModelsListResponse = z.infer<typeof ModelsListResponseSchema>;
export type Model = z.infer<typeof ModelSchema>;
