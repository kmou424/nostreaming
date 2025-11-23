import { logger } from "../logger";
import { ProviderRouter } from "../providers/router";
import type { ModelsList } from "../providers/types";
import type { ModelsListResponse } from "../schemas/openai";

/**
 * Handle GET /v1/models request
 * Returns all available models as ModelAlias
 */
export async function handleModels(): Promise<ModelsListResponse> {
  logger.debug("Handling models request");
  let models: ModelsList | null | undefined;
  let err: Error | null = null;
  ({ models, err } = await ProviderRouter.models());

  if (err || !models) {
    logger.error("Failed to get models", {
      error: err?.message,
    });
    throw new Error(`Failed to get models: ${err?.message ?? "Unknown error"}`);
  }

  // Convert ModelsList to OpenAI format
  // Model.id contains ModelAlias (provider_name/model_id)
  const modelsList: ModelsListResponse = {
    object: "list",
    data: models
      .map((model) => ({
        id: model.id, // This is a ModelAlias (provider_name/model_id)
        object: "model" as const,
        created: model.created ?? Math.floor(Date.now() / 1000),
        owned_by: model.owned_by ?? "system",
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  logger.debug("Models request completed", {
    modelCount: modelsList.data.length,
  });
  return modelsList;
}
