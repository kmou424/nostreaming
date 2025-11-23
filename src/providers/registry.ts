import type { ProviderConfig } from "../config/schema";
import type { ProviderClient, ProviderFactory } from "./types";
import { ProviderType } from "./types";

/**
 * Provider registry for managing provider factories
 *
 * Note: Each ProviderType registers one factory function, but the same type
 * can have multiple instances with different names. The name is used to isolate
 * different provider instances (e.g., multiple OpenAI accounts or endpoints).
 */
class ProviderRegistryImpl {
  private factories = new Map<ProviderType, ProviderFactory>();

  /**
   * Register a provider factory for a specific type
   * Each ProviderType should be registered once with its factory function.
   * The same type can later create multiple instances with different names.
   *
   * @param type Provider type (e.g., ProviderType.OpenAI)
   * @param factory Factory function to create provider client instances
   */
  register(type: ProviderType, factory: ProviderFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Create a provider client instance from configuration
   *
   * The same ProviderType can have multiple instances with different names.
   * For example, you can have "openai-primary" and "openai-secondary" both
   * using ProviderType.OpenAI but with different configurations.
   *
   * @param name Provider name (used for isolation, e.g., "my-openai")
   * @param config Provider configuration (endpoint, api_key, etc.)
   * @returns Provider client instance
   * @throws Error if provider type is not registered or invalid
   */
  createClient(name: string, config: ProviderConfig): ProviderClient {
    const type = config.type as ProviderType;
    const factory = this.factories.get(type);

    if (!factory) {
      throw new Error(
        `Provider type "${type}" is not registered. Available types: ${Array.from(
          this.factories.keys()
        ).join(", ")}`
      );
    }

    // Validate that the config has the required type
    if (!Object.values(ProviderType).includes(type)) {
      throw new Error(`Invalid provider type: ${type}`);
    }

    return factory(name, { ...config, type });
  }

  /**
   * Check if a provider type is registered
   * @param type Provider type
   * @returns True if registered, false otherwise
   */
  isRegistered(type: ProviderType): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered provider types
   * @returns Array of registered provider types
   */
  getRegisteredTypes(): ProviderType[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Global provider registry instance
 */
export const ProviderRegistry = new ProviderRegistryImpl();
