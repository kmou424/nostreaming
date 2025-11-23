import { Elysia } from "elysia";
import { handleCompletion, handleModels } from "../handlers";
import { AuthMiddleware } from "../middleware/auth";
import {
  ChatCompletionsRequestSchema,
  ModelsListResponseSchema,
} from "../schemas/openai";

export const OpenAIRoutes = new Elysia({ prefix: "/v1" })
  .use(AuthMiddleware)
  .post(
    "/chat/completions",
    async ({ body, set }) => {
      const response = await handleCompletion(body);

      // If response is a stream, set SSE headers and return stream
      if (response instanceof ReadableStream) {
        set.headers = {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        };
        return new Response(response);
      }

      // Normal JSON response
      return response;
    },
    {
      body: ChatCompletionsRequestSchema,
    }
  )
  .get(
    "/models",
    async () => {
      return await handleModels();
    },
    {
      response: ModelsListResponseSchema,
    }
  );
