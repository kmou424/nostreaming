import { getConfig, getProviderConfig, type ProviderConfig } from "../config";
import { logger } from "../logger";
import { Result } from "../type/result";
import { FilterUtil } from "../utils";
import { ProviderRegistry } from "./registry";
import type { ModelAlias, ModelsList, ProviderClient } from "./types";

/**
 * Provider manager for managing provider lifecycle
 *
 * Responsibilities:
 * - Initialize and manage provider clients
 * - Maintain model alias to provider mapping (ModelAlias -> provider_name)
 * - Refresh provider models and update mapping
 * - Destroy providers and clean up mappings
 *
 * Does NOT handle business logic or request routing.
 * Use ProviderRouter for routing completion requests and getting models.
 */
class ProviderManagerImpl {
  private clients = new Map<string, ProviderClient>();
  // Mapping: ModelAlias (provider_name/model_id) -> provider name
  private modelAliasesMapping = new Map<ModelAlias, string>();

  /**
   * Initialize all enabled providers from configuration
   *
   * For each provider:
   * 1. Create client instance
   * 2. Call create() to validate endpoint/key (fetches and caches models)
   * 3. Register all models to the mapping
   *
   * @param providers Providers configuration object
   * @returns Promise that resolves with Result<void>
   */
  async initializeProviders(
    providers: Record<string, ProviderConfig> | undefined
  ): Promise<Result<void>> {
    let err: Error | null = null;

    const allProviders = providers ?? {};
    const enabledProviders = Object.entries(allProviders).filter(
      ([, config]) => config.enabled
    );

    logger.info("Initializing providers", {
      total: Object.keys(allProviders).length,
      enabled: enabledProviders.length,
      disabled: Object.keys(allProviders).length - enabledProviders.length,
    });

    // Process all providers, including disabled ones
    for (const [name, providerConfig] of Object.entries(allProviders)) {
      // Check if provider is enabled
      if (!providerConfig.enabled) {
        logger.info("[Provider] Skipped", {
          name,
          type: providerConfig.type,
        });
        continue;
      }

      logger.debug("[Provider] Creating provider client", {
        name,
        type: providerConfig.type,
      });
      const client = ProviderRegistry.createClient(name, providerConfig);

      // Create and validate provider (fetches models internally)
      logger.debug("[Provider] Validating provider connection", { name });
      ({ err } = await client.create());
      if (err) {
        logger.error("[Provider] Failed to initialize provider", {
          name,
          error: err.message,
        });
        return Result<void>(
          new Error(
            `Failed to initialize provider "${name}": ${
              err.message ?? "Unknown error"
            }`
          )
        );
      }

      // Get models from cache (created during create())
      let models: ModelsList | null | undefined;
      ({ models, err } = await client.models());
      if (models && !err) {
        // Apply filter and register models
        const filteredModels = this.applyFilter(name, models);
        this.registerModels(name, filteredModels);
      } else {
        logger.warn("[Provider] Failed to get models for registration", {
          name,
          error: err?.message,
        });
      }

      this.clients.set(name, client);
      logger.info("[Provider] Initialized", {
        name,
        modelCount: Array.from(this.modelAliasesMapping.values()).filter(
          (p) => p === name
        ).length,
      });
    }

    return Result<void>(undefined as void);
  }

  /**
   * Refresh models for a specific provider
   *
   * Process:
   * 1. Remove all existing models for this provider
   * 2. Fetch latest models from upstream
   * 3. Register new models
   *
   * @param name Provider name
   * @returns Promise that resolves with Result<ModelsList>
   */
  async refreshModels(name: string): Promise<Result<ModelsList>> {
    logger.debug("Refreshing models for provider", { name });
    const client = this.clients.get(name);
    if (!client) {
      logger.warn("Provider not found for model refresh", { name });
      return Result<ModelsList>(new Error(`Provider "${name}" not found`));
    }

    // Remove all existing models for this provider
    this.removeModels(name);
    logger.debug("Removed existing models", { name });

    // Fetch latest models from upstream
    let models: ModelsList | null | undefined;
    let err: Error | null = null;
    ({ models, err } = await client.refreshModels());
    if (err || !models) {
      logger.error("Failed to refresh models", {
        name,
        error: err?.message,
      });
      return Result<ModelsList>(err || new Error("Failed to refresh models"));
    }

    // Apply filter if configured
    const originalCount = models.length;
    const filteredModels = this.applyFilter(name, models);
    let finalResult: Result<ModelsList>;

    if (filteredModels.length !== originalCount) {
      logger.info("Models filtered", {
        name,
        originalCount,
        filteredCount: filteredModels.length,
      });
      // Create new result with filtered models
      finalResult = Result<ModelsList>(filteredModels);
    } else {
      finalResult = Result<ModelsList>(models);
    }

    // Register filtered models directly (reuse the filtered list from refreshModels)
    this.registerModels(name, filteredModels);
    logger.info("Models refreshed successfully", {
      name,
      modelCount: filteredModels.length,
    });

    return finalResult;
  }

  /**
   * Destroy a provider
   *
   * Removes:
   * - All model mappings for this provider
   * - The provider client from registry
   *
   * @param name Provider name
   * @returns Promise that resolves with Result<void>
   */
  async destroyProvider(name: string): Promise<Result<void>> {
    if (!this.clients.has(name)) {
      return Result<void>(new Error(`Provider "${name}" not found`));
    }

    // Remove all models associated with this provider
    this.removeModels(name);

    // Remove the client
    this.clients.delete(name);

    return Result<void>(undefined as void);
  }

  /**
   * Register models from a provider to the model alias mapping
   * Creates ModelAlias for each model: "provider_name/model_id"
   * Models should already be filtered before calling this method
   * @private
   */
  private registerModels(providerName: string, models: ModelsList): void {
    const count = models.length;
    for (const model of models) {
      const modelAlias: ModelAlias = `${providerName}/${model.id}`;
      this.modelAliasesMapping.set(modelAlias, providerName);
    }
    logger.debug("Registered models", { providerName, count });
  }

  /**
   * Apply filter to models list based on provider configuration
   * - whitelist: returns intersection of upstream models and filter.models
   * - blacklist: returns upstream models minus filter.models
   * @private
   */
  private applyFilter(providerName: string, models: ModelsList): ModelsList {
    try {
      const config = getConfig();
      const providerConfig = getProviderConfig(config, providerName);

      if (!providerConfig?.filter) {
        // No filter configured, return all models
        return models;
      }

      const filter = providerConfig.filter;
      const filterModelIds = new Set(filter.models);

      // Apply filter using FilterUtil
      const filtered = FilterUtil.apply(models, filterModelIds, filter.mode);

      logger.debug(`Applied ${filter.mode} filter`, {
        providerName,
        upstreamCount: models.length,
        filterCount: filter.models.length,
        filteredCount: filtered.length,
      });

      return filtered;
    } catch (error) {
      logger.error("Failed to apply filter", {
        providerName,
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, return all models
      return models;
    }
  }

  /**
   * Remove all model aliases associated with a provider
   * @private
   */
  private removeModels(providerName: string): void {
    const aliasesToRemove: ModelAlias[] = [];
    for (const [modelAlias, provider] of this.modelAliasesMapping.entries()) {
      if (provider === providerName) {
        aliasesToRemove.push(modelAlias);
      }
    }
    for (const alias of aliasesToRemove) {
      this.modelAliasesMapping.delete(alias);
    }
  }

  /**
   * Get a provider client by name
   * Used by ProviderRouter for routing requests
   * @internal
   */
  getClient(name: string): ProviderClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Get the model alias to provider mapping
   * Used by ProviderRouter for routing requests
   * @internal
   */
  getModelAliasesMapping(): Map<ModelAlias, string> {
    return new Map(this.modelAliasesMapping);
  }
}

/**
 * Global provider manager instance
 */
export const ProviderManager = new ProviderManagerImpl();
