import { Elysia } from "elysia";
import { isValidKey } from "../config";
import { logger } from "../logger";

const BearerTokenPrefix = "Bearer ";

/**
 * Authentication middleware for Bearer token authentication
 */
export const AuthMiddleware = new Elysia({ name: "auth" }).onRequest(
  async ({ request, set }) => {
    const headers = request.headers;
    const authHeader =
      headers.get("Authorization") || headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Missing Authorization header",
            type: "authentication_error",
          },
        }),
        { status: 401 }
      );
    }

    if (!authHeader.startsWith(BearerTokenPrefix)) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Invalid Authorization header format",
            type: "authentication_error",
          },
        }),
        { status: 401 }
      );
    }

    const token = authHeader.slice(BearerTokenPrefix.length).trim();

    if (!isValidKey(token)) {
      logger.warn("Invalid API key", {
        keyPrefix: token.slice(0, 8) + "...",
      });
      return new Response(
        JSON.stringify({
          error: {
            message: "Invalid API key",
            type: "authentication_error",
          },
        }),
        { status: 401 }
      );
    }

    logger.debug("Authentication successful", {
      keyPrefix: token.substring(0, 8) + "...",
    });
    return;
  }
);
