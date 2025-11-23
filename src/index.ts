import { Elysia } from "elysia";
import { loadConfig, setConfig } from "./config";
import { logger } from "./logger";
import { ProviderManager } from "./providers/manager";
import { HealthRoutes } from "./routes/health";
import { OpenAIRoutes } from "./routes/openai";

import "./providers/impl";

// Load and initialize global configuration
logger.info("Loading configuration...");
const config = loadConfig();
setConfig(config);
logger.info("Configuration loaded", {
  host: config.app.host,
  port: config.app.port,
  logLevel: config.logging?.level ?? "info",
});

// Initialize providers
let err: Error | null = null;
({ err } = await ProviderManager.initializeProviders(config.providers));
if (err) {
  logger.error("Failed to initialize providers", {
    error: err.message,
  });
  process.exit(1);
}

// Start server
const app = new Elysia().use(HealthRoutes).use(OpenAIRoutes).listen({
  hostname: config.app.host,
  port: config.app.port,
});

logger.info(
  `Server started at http://${app.server?.hostname}:${app.server?.port}`
);

// Shutdown handler
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting shutdown...`);

  try {
    // Stop the Elysia server
    await app.stop();
    logger.info("Server stopped");
  } catch (error) {
    logger.error("Error during shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    logger.info("Shutdown complete");
    process.exit(0);
  }
};

// Listen for termination signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
