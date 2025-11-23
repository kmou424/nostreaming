import type { ModelsList } from "../providers/types";

/**
 * Filter utility class for filtering models list
 * Provides static methods for whitelist and blacklist filtering
 */
export class FilterUtil {
  /**
   * Apply whitelist filter
   * Returns intersection of upstream models and filter list
   * Only models that exist in both lists will be returned
   *
   * @param models Upstream models list
   * @param filterModelIds Set of model IDs to whitelist
   * @returns Filtered models list (intersection)
   */
  static whitelist(
    models: ModelsList,
    filterModelIds: Set<string>
  ): ModelsList {
    return models.filter((model) => filterModelIds.has(model.id));
  }

  /**
   * Apply blacklist filter
   * Returns difference of upstream models minus filter list
   * Models that exist in filter list will be removed
   *
   * @param models Upstream models list
   * @param filterModelIds Set of model IDs to blacklist
   * @returns Filtered models list (difference)
   */
  static blacklist(
    models: ModelsList,
    filterModelIds: Set<string>
  ): ModelsList {
    return models.filter((model) => !filterModelIds.has(model.id));
  }

  /**
   * Apply filter based on mode
   * Convenience method that calls whitelist or blacklist based on mode
   *
   * @param models Upstream models list
   * @param filterModelIds Set of model IDs to filter
   * @param mode Filter mode: "whitelist" or "blacklist"
   * @returns Filtered models list
   */
  static apply(
    models: ModelsList,
    filterModelIds: Set<string>,
    mode: "whitelist" | "blacklist"
  ): ModelsList {
    if (mode === "whitelist") {
      return FilterUtil.whitelist(models, filterModelIds);
    } else {
      return FilterUtil.blacklist(models, filterModelIds);
    }
  }
}
