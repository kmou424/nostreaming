import { parse as parseToml } from "@iarna/toml";
import { readFileSync } from "node:fs";
import { ConfigSchema, type Config, type ProviderConfig } from "./schema";

/**
 * Load and parse TOML configuration file
 * @param path Path to the TOML configuration file
 * @returns Parsed and validated configuration
 */
/**
 * Clean TOML parsed object by removing Symbol properties
 * TOML parser adds internal Symbol properties that Zod cannot validate
 */
function cleanTomlObject(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanTomlObject);
  }

  const cleaned: any = {};
  for (const key in obj) {
    // Only copy string keys, skip Symbol properties
    if (typeof key === "string") {
      cleaned[key] = cleanTomlObject(obj[key]);
    }
  }
  return cleaned;
}

export function loadConfig(path: string = "config.toml"): Config {
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = parseToml(content);
    // Clean the parsed object to remove Symbol properties
    const cleaned = cleanTomlObject(parsed);
    return ConfigSchema.parse(cleaned);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${path}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get a specific provider configuration by name
 * @param config The loaded configuration
 * @param providerName The name of the provider
 * @returns Provider configuration or undefined if not found
 */
export function getProviderConfig(
  config: Config,
  providerName: string
): ProviderConfig | undefined {
  return config.providers?.[providerName];
}

/**
 * Get all enabled providers from configuration
 * @param config The loaded configuration
 * @returns Map of provider name to provider configuration
 */
export function getEnabledProviders(
  config: Config
): Record<string, ProviderConfig> {
  if (!config.providers) {
    return {};
  }

  const enabled: Record<string, ProviderConfig> = {};
  for (const [name, provider] of Object.entries(config.providers)) {
    if (provider.enabled) {
      enabled[name] = provider;
    }
  }
  return enabled;
}

/**
 * Global configuration instance
 * Should be initialized during application startup
 */
let globalConfig: Config | null = null;

/**
 * Keys map for O(1) authentication lookup
 * Key: API key string, Value: true (for existence check)
 */
let keysMap: Map<string, boolean> = new Map();

/**
 * Initialize global configuration
 * @param config The loaded configuration
 */
export function setConfig(config: Config): void {
  globalConfig = config;
  // Preload keys into Map for O(1) access
  initializeKeysMap(config.app.keys);
}

/**
 * Initialize keys map from keys array
 * @param keys Array of API keys
 */
function initializeKeysMap(keys: string[]): void {
  keysMap.clear();
  if (keys && keys.length > 0) {
    for (const key of keys) {
      keysMap.set(key, true);
    }
  }
}

/**
 * Check if a key exists in the keys map (O(1) lookup)
 * @param key The API key to check
 * @returns true if key exists, false otherwise
 */
export function isValidKey(key: string): boolean {
  return keysMap.has(key);
}

/**
 * Get the global configuration
 * @returns The global configuration
 * @throws Error if config is not initialized
 */
export function getConfig(): Config {
  if (!globalConfig) {
    throw new Error("Configuration not initialized. Call setConfig() first.");
  }
  return globalConfig;
}

// Re-export types
export type {
  AppConfig,
  Config,
  LoggingConfig,
  ProviderConfig,
} from "./schema";
