import type { ProviderConfig } from "../config/schema";
import type {
  ChatCompletionsRequest,
  ChatCompletionsResponse,
} from "../schemas/openai";
import type { Result } from "../type/result";

/**
 * Provider type enumeration
 */
export enum ProviderType {
  OpenAI = "openai",
  // GoogleAI = "google-ai",
  // Anthropic = "anthropic",
}

/**
 * Provider configuration with validated type
 */
export interface TypedProviderConfig extends ProviderConfig {
  type: ProviderType;
}

/**
 * Model alias: a scoped identifier for models in the system
 * Format: "provider_name/model_id"
 * This uniquely identifies a model within the system and allows routing to the correct provider.
 */
export type ModelAlias = string;

/**
 * Model information from upstream provider
 */
export interface ModelInfo {
  id: string;
  created?: number;
  owned_by?: string;
  [key: string]: unknown; // Allow additional provider-specific fields
}

/**
 * Models list - array of model information
 */
export type ModelsList = ModelInfo[];

/**
 * ProviderClient interface
 * All provider clients must implement this interface
 *
 * Design principles:
 * - Minimal coupling: only getName() is required (config can be retrieved by name)
 * - Standardized operations: completion, models, refreshModels
 * - State validation: create() method performs actual state check by fetching model list
 */
export interface ProviderClient {
  /**
   * Get the provider name
   * This is the only method that exposes provider identity.
   * Other information can be retrieved from config using the name.
   */
  getName(): string;

  /**
   * Initialize/create the provider client
   * This method performs actual state check by:
   * 1. Connecting to the provider API
   * 2. Fetching model list to validate API endpoint and key (acts as health check)
   * 3. Caching the model list and client state
   * 4. Persisting the client if needed
   *
   * Called during application startup.
   *
   * @returns Promise that resolves with Result<void>
   * - If successful: Result with data = undefined, err = null
   * - If failed: Result with err containing the error (invalid endpoint/key or connection failure)
   */
  create(): Promise<Result<void>>;

  /**
   * Create a chat completion
   * @param request Chat completion request
   * @returns Promise that resolves with Result<ChatCompletionsResponse>
   * - If successful: Result with data containing the response, err = null
   * - If failed: Result with err containing the error
   */
  completion(
    request: ChatCompletionsRequest
  ): Promise<Result<ChatCompletionsResponse>>;

  /**
   * Get the list of available models
   * By default, this should return cached models.
   * @returns Promise that resolves with Result<ModelsList>
   * - If successful: Result with data containing the models list, err = null
   * - If failed: Result with err containing the error
   */
  models(): Promise<Result<ModelsList>>;

  /**
   * Refresh the models list from the upstream provider
   * This will fetch the latest models and update the cache.
   * @returns Promise that resolves with Result<ModelsList>
   * - If successful: Result with data containing the updated models list, err = null
   * - If failed: Result with err containing the error
   */
  refreshModels(): Promise<Result<ModelsList>>;
}

/**
 * Provider factory function type
 * Used to create provider clients from configuration
 */
export type ProviderFactory = (
  name: string,
  config: TypedProviderConfig
) => ProviderClient;
