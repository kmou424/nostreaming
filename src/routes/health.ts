import { Elysia } from "elysia";
import { getLocalISOString } from "../utils/time";

/**
 * Health check route
 * This route is independent and does not require authentication
 * Used for Docker health checks and monitoring
 */
export const HealthRoutes = new Elysia({ prefix: "/health" }).get("/", () => {
  return {
    status: "ok",
    timestamp: getLocalISOString(),
    service: "nostreaming",
  };
});
