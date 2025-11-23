export * from "./openai";

import { ProviderRegistry } from "../registry";
import { ProviderType } from "../types";
import { OpenAIProviderClient } from "./openai";

ProviderRegistry.register(ProviderType.OpenAI, (name, config) => {
  return new OpenAIProviderClient(name, config);
});
