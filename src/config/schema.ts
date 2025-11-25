import { z } from "zod";

// App configuration schema
export const AppConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().int().positive().default(3000),
  fakeStreamInterval: z.number().int().positive().default(500), // milliseconds
  keys: z.array(z.string().min(1)), // API keys for authentication
  maxRetries: z.number().int().positive().default(3), // retries for upstream requests
});

// Logging configuration schema
export const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

// Provider filter configuration schema
export const ProviderFilterSchema = z.object({
  mode: z.enum(["whitelist", "blacklist"]),
  models: z.array(z.string().min(1)),
});

// Provider configuration schema
export const ProviderConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    type: z.literal("openai"), // Currently only supports OpenAI
    endpoint: z.url(),
    api_key: z.string().min(1),
    filter: ProviderFilterSchema.optional(),
    // Allow additional provider-specific fields
  })
  .passthrough();

// Root configuration schema
export const ConfigSchema = z.object({
  app: AppConfigSchema,
  logging: LoggingConfigSchema.optional(),
  providers: z.record(z.string(), ProviderConfigSchema).optional(),
});

// Type exports
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ProviderFilter = z.infer<typeof ProviderFilterSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
