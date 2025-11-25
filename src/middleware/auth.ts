import { Elysia } from "elysia";
import { isValidKey } from "../config";
import { logger } from "../logger";

const BearerTokenPrefix = "Bearer ";

/**
 * Authentication error response
 */
const newAuthError = (message: string) =>
  new Response(
    JSON.stringify({ error: { message, type: "authentication_error" } }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );

/**
 * Authentication middleware for Bearer token authentication
 */
export const AuthMiddleware = (app: Elysia) =>
  app
    .derive(({ headers }) => {
      const auth = headers.authorization ?? "";
      const token = auth.startsWith(BearerTokenPrefix)
        ? auth.slice(BearerTokenPrefix.length).trim()
        : null;
      return { token };
    })
    .onBeforeHandle(({ token }) => {
      if (!token)
        return newAuthError("Missing or invalid Authorization header");

      if (!isValidKey(token)) {
        logger.warn("Invalid API key", {
          keyPrefix: token.slice(0, 8) + "...",
        });
        return newAuthError("Invalid API key");
      }

      logger.debug("Auth success", { keyPrefix: token.slice(0, 8) + "..." });
    });
