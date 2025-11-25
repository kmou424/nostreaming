import { getConfig } from "../config";
import { logger } from "../logger";
import { ProviderRouter } from "../providers/router";
import type {
  ChatCompletionsRequest,
  ChatCompletionsResponse,
} from "../schemas/openai";
import { Result } from "../type/result";
import { spoofRequestContent } from "../utils";

/**
 * Automatically retry completion request up to max retries
 * @param request Chat completion request
 * @returns Promise that resolves with Result<ChatCompletionsResponse>
 * - If successful: Result with data containing the response, err = null
 * - If failed: Result with err containing the error
 */
async function autoRetryCompletion(
  request: ChatCompletionsRequest
): Promise<Result<ChatCompletionsResponse>> {
  const config = getConfig();
  const maxRetries = config.advanced.maxRetries;
  for (let i = 1; i <= maxRetries; i++) {
    const { response, err } = await ProviderRouter.completion(request);
    if (err || !response) {
      logger.error("Completion request failed, trying again...", {
        model: request.model,
        error: err?.message,
        retry: i,
      });
      continue;
    }

    if (response.usage.completion_tokens === 0) {
      logger.warn(
        "Completion request returned empty response, trying again...",
        {
          model: request.model,
          retry: i,
        }
      );
      continue;
    }

    return Result<ChatCompletionsResponse>(response);
  }
  return Result<ChatCompletionsResponse>(new Error("Failed after max retries"));
}

/**
 * Handle POST /v1/chat/completions request
 * Routes the request to the correct provider based on ModelAlias
 *
 * If stream=true, implements fake-streaming:
 * - Sends empty SSE data packets while waiting for upstream response
 * - Once upstream responds, sends the full content as the final packet
 */
export async function handleCompletion(
  request: ChatCompletionsRequest
): Promise<ChatCompletionsResponse | ReadableStream> {
  const config = getConfig();

  // Spoof request content if enabled
  if (config.advanced.contentSpoof) {
    request = spoofRequestContent(request);
  }

  // If stream is false or undefined, return normal response
  if (!request.stream) {
    logger.info("Starting non-streaming completion request", {
      model: request.model,
      messageCount: request.messages.length,
    });

    let response: ChatCompletionsResponse | null | undefined;
    let err: Error | null = null;
    ({ response, err } = await autoRetryCompletion(request));

    if (err || !response) {
      logger.error("Non-streaming completion request failed", {
        model: request.model,
        messageCount: request.messages.length,
        error: err?.message,
      });
      throw new Error(
        `Failed to create completion: ${err?.message ?? "Unknown error"}`
      );
    }
    logger.info("Non-streaming completion request succeeded", {
      model: request.model,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    });
    return response;
  }

  // Stream is true - implement fake-streaming
  logger.info("Starting fake-streaming completion request", {
    model: request.model,
    messageCount: request.messages.length,
  });
  return createFakeStream(request);
}

/**
 * Create a fake-streaming response
 * Sends empty SSE data packets while waiting for upstream response,
 * then sends the full response as the final packet
 */
async function createFakeStream(
  request: ChatCompletionsRequest
): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  const config = getConfig();
  const FAKE_STREAM_INTERVAL = config.advanced.fakeStreamInterval; // milliseconds

  // Generate a temporary response ID and timestamp for empty data packets
  const tempId = `chatcmpl-${Date.now()}`;
  const tempCreated = Math.floor(Date.now() / 1000);

  // Shared state for cleanup
  let fakeStreamTimer: ReturnType<typeof setInterval> | null = null;
  let isCancelled = false;

  return new ReadableStream({
    async start(controller) {
      let isCompleted = false;

      // Helper function to safely enqueue data
      const safeEnqueue = (data: Uint8Array): boolean => {
        if (isCompleted || isCancelled) {
          return false;
        }
        try {
          controller.enqueue(data);
          return true;
        } catch (error) {
          // Controller might be closed by client
          if (error instanceof TypeError && error.message.includes("closed")) {
            isCancelled = true;
            logger.debug("Client disconnected, controller closed", {
              model: request.model,
            });
            return false;
          }
          throw error;
        }
      };

      // Send empty data packet (OpenAI SSE format)
      const sendEmptyData = () => {
        if (isCompleted || isCancelled) {
          if (fakeStreamTimer) {
            clearInterval(fakeStreamTimer);
            fakeStreamTimer = null;
          }
          return;
        }
        // Send empty content data packet in OpenAI streaming format
        const emptyData = `data: ${JSON.stringify({
          id: tempId,
          object: "chat.completion.chunk",
          created: tempCreated,
          model: request.model,
          choices: [
            {
              index: 0,
              delta: {
                content: "",
              },
              finish_reason: null,
            },
          ],
        })}\n\n`;
        if (safeEnqueue(encoder.encode(emptyData))) {
          logger.debug("Sent empty data packet (keep-alive)", {
            model: request.model,
            length: emptyData.length,
          });
        }
      };

      // Start sending empty data packets periodically
      fakeStreamTimer = setInterval(sendEmptyData, FAKE_STREAM_INTERVAL);

      try {
        // Request completion from provider (non-streaming)
        let response: ChatCompletionsResponse | null | undefined;
        let err: Error | null = null;
        ({ response, err } = await autoRetryCompletion(request));

        // Stop sending empty data packets
        if (fakeStreamTimer) {
          clearInterval(fakeStreamTimer);
          fakeStreamTimer = null;
        }

        if (err || !response) {
          logger.error("Fake-streaming completion request failed", {
            model: request.model,
            messageCount: request.messages.length,
            error: err?.message,
          });
          if (!isCancelled) {
            const errorData = `data: ${JSON.stringify({
              error: {
                message: err?.message ?? "Unknown error",
                type: "completion_error",
              },
            })}\n\n`;
            if (safeEnqueue(encoder.encode(errorData))) {
              try {
                controller.close();
              } catch (closeError) {
                // Ignore close errors if already closed
                logger.error("Controller already closed");
              }
            }
          }
          return;
        }

        // Send the full response as streaming chunks
        // Format: OpenAI streaming format

        // Log success with token information
        logger.info("Fake-streaming completion request succeeded", {
          model: request.model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        });

        // Check if client disconnected before sending response
        if (isCancelled) {
          logger.error("Client disconnected before sending response");
          return;
        }

        // Send initial chunk with role (if present)
        const firstChoice = response.choices[0];
        if (firstChoice && firstChoice.message.role) {
          const roleChunk = `data: ${JSON.stringify({
            id: response.id,
            object: "chat.completion.chunk",
            created: response.created,
            model: response.model,
            choices: [
              {
                index: firstChoice.index,
                delta: {
                  role: firstChoice.message.role,
                },
                finish_reason: null,
              },
            ],
          })}\n\n`;
          if (!safeEnqueue(encoder.encode(roleChunk))) {
            return;
          } else {
            logger.debug("Sent role chunk", {
              model: request.model,
              length: roleChunk.length,
            });
          }
        }

        // Send content chunk with full content
        // In fake-streaming, we send the full content at once
        const contentChunk = `data: ${JSON.stringify({
          id: response.id,
          object: "chat.completion.chunk",
          created: response.created,
          model: response.model,
          choices: response.choices.map((choice) => ({
            index: choice.index,
            delta: {
              content: choice.message.content,
            },
            finish_reason: null,
          })),
        })}\n\n`;
        if (!safeEnqueue(encoder.encode(contentChunk))) {
          return;
        } else {
          logger.debug("Sent content chunk", {
            model: request.model,
            length: contentChunk.length,
          });
        }

        // Send finish chunk with finish_reason
        const finishChunk = `data: ${JSON.stringify({
          id: response.id,
          object: "chat.completion.chunk",
          created: response.created,
          model: response.model,
          choices: response.choices.map((choice) => ({
            index: choice.index,
            delta: {},
            finish_reason: choice.finish_reason,
          })),
        })}\n\n`;
        if (!safeEnqueue(encoder.encode(finishChunk))) {
          return;
        } else {
          logger.debug("Sent finish reason", {
            model: request.model,
            length: finishChunk.length,
          });
        }

        // Send [DONE] marker
        if (!safeEnqueue(encoder.encode("data: [DONE]\n\n"))) {
          return;
        } else {
          logger.debug("Sent [DONE] marker", {
            model: request.model,
            length: "[DONE]".length,
          });
        }
        isCompleted = true;
        try {
          controller.close();
        } catch (closeError) {
          // Ignore close errors if already closed
          logger.error("Controller already closed");
        }
      } catch (error) {
        // Stop sending empty data packets on error
        if (fakeStreamTimer) {
          clearInterval(fakeStreamTimer);
          fakeStreamTimer = null;
        }

        logger.info("Fake-streaming completion request error", {
          model: request.model,
          messageCount: request.messages.length,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!isCancelled) {
          const errorData = `data: ${JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : String(error),
              type: "completion_error",
            },
          })}\n\n`;
          if (safeEnqueue(encoder.encode(errorData))) {
            try {
              controller.close();
            } catch (closeError) {
              // Ignore close errors if already closed
              logger.error("Controller already closed");
            }
          }
        }
      }
    },
    cancel() {
      // Handle client disconnection
      isCancelled = true;
      if (fakeStreamTimer) {
        clearInterval(fakeStreamTimer);
        fakeStreamTimer = null;
      }
      logger.error("Client disconnected, stream cancelled");
    },
  });
}
