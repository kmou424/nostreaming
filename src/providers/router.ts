import { logger } from "../logger";
import type {
  ChatCompletionsRequest,
  ChatCompletionsResponse,
} from "../schemas/openai";
import { Result } from "../type/result";
import { ProviderManager } from "./manager";
import type { ModelAlias, ModelsList } from "./types";

/**
 * Provider router for routing requests to the correct provider
 *
 * This class handles business logic related to routing:
 * - Routes completion requests based on ModelAlias
 * - Returns unified model list (using ModelAlias)
 * - Manages model alias to provider mapping for request routing
 *
 * Should be initialized after ProviderManager has initialized all providers.
 * This is the main interface for business logic that needs to interact with providers.
 */
class ProviderRouterImpl {
  /**
   * Get all available models
   * Returns all ModelAlias values (format: "provider_name/model_id")
   * @returns Promise that resolves with Result<ModelsList>
   * - If successful: Result with data containing all models (as ModelAlias), err = null
   * - If failed: Result with err containing the error
   */
  async models(): Promise<Result<ModelsList>> {
    const modelAliasesMapping = ProviderManager.getModelAliasesMapping();
    const modelAliases = Array.from(modelAliasesMapping.keys());
    const modelsList: ModelsList = modelAliases.map((alias) => ({
      id: alias,
    }));
    return Result<ModelsList>(modelsList);
  }

  /**
   * Create a chat completion
   * Automatically routes to the correct provider based on the ModelAlias.
   * The model field should be a ModelAlias (format: "provider_name/model_id").
   * The provider_name/ prefix will be trimmed before sending to the provider.
   *
   * Note: The stream parameter is forced to false to prevent streaming responses.
   * This ensures non-streaming requests to upstream providers.
   *
   * @param request Chat completion request (model field should be a ModelAlias)
   * @returns Promise that resolves with Result<ChatCompletionsResponse>
   * - If successful: Result with data containing the response, err = null
   * - If failed: Result with err containing the error
   */
  async completion(
    request: ChatCompletionsRequest
  ): Promise<Result<ChatCompletionsResponse>> {
    const modelAlias: ModelAlias = request.model;
    logger.debug("Routing completion request", { modelAlias });
    const modelAliasesMapping = ProviderManager.getModelAliasesMapping();
    const providerName = modelAliasesMapping.get(modelAlias);

    if (!providerName) {
      logger.warn("ModelAlias not found", { modelAlias });
      return Result<ChatCompletionsResponse>(
        new Error(
          `ModelAlias "${modelAlias}" not found or provider not available`
        )
      );
    }

    const client = ProviderManager.getClient(providerName);
    if (!client) {
      logger.error("Provider client not found", { providerName, modelAlias });
      return Result<ChatCompletionsResponse>(
        new Error(`Provider "${providerName}" not found`)
      );
    }

    // Trim the provider_name/ prefix from the ModelAlias to get the actual model ID
    const modelPrefix = `${providerName}/`;
    const actualModel = modelAlias.startsWith(modelPrefix)
      ? modelAlias.slice(modelPrefix.length)
      : modelAlias;

    // Create a new request with the trimmed model name
    // Force stream to false to prevent streaming responses
    const providerRequest: ChatCompletionsRequest = {
      ...request,
      model: actualModel,
      stream: false,
    };

    logger.debug("Forwarding request to provider", {
      providerName,
      model: actualModel,
    });
    let response: ChatCompletionsResponse | null | undefined;
    let err: Error | null = null;
    ({ response, err } = await client.completion(providerRequest));

    if (err || !response) {
      logger.error("Completion request failed", {
        providerName,
        model: actualModel,
        error: err?.message,
      });
      return Result<ChatCompletionsResponse>(
        err || new Error("Completion failed")
      );
    } else {
      logger.debug("Completion request succeeded", {
        providerName,
        model: actualModel,
      });
    }

    return Result<ChatCompletionsResponse>(response);
  }
}

/**
 * Global provider router instance
 */
export const ProviderRouter = new ProviderRouterImpl();
