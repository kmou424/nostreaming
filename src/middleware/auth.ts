import { Elysia } from "elysia";
import { isValidKey } from "../config";
import { logger } from "../logger";

const BearerTokenPrefix = "Bearer ";

/**
 * Authentication middleware for Bearer token authentication
 */
export const AuthMiddleware = new Elysia({ name: "auth" }).onBeforeHandle(
  async ({ headers, set }) => {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader) {
      logger.warn("Missing Authorization header");
      set.status = 401;
      return {
        error: {
          message:
            "Missing Authorization header. Please provide a Bearer token in the Authorization header.",
          type: "authentication_error",
        },
      };
    }

    if (!authHeader.startsWith(BearerTokenPrefix)) {
      logger.warn("Invalid Authorization header format", {
        header: authHeader.substring(0, 20) + "...",
      });
      set.status = 401;
      return {
        error: {
          message:
            "Invalid Authorization header format. Expected 'Bearer <token>'.",
          type: "authentication_error",
        },
      };
    }

    const token = authHeader.substring(BearerTokenPrefix.length).trim();

    if (!isValidKey(token)) {
      logger.warn("Invalid API key", {
        keyPrefix: token.substring(0, 8) + "...",
      });
      set.status = 401;
      return {
        error: {
          message: "Invalid API key provided.",
          type: "authentication_error",
        },
      };
    }

    logger.debug("Authentication successful", {
      keyPrefix: token.substring(0, 8) + "...",
    });
    return;
  }
);
