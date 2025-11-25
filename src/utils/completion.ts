import type { ChatCompletionsRequest } from "../schemas/openai";

function generateRandomContent() {
  // generate from ASCII characters
  const length = Math.floor(Math.random() * 6) + 5; // 5-10 characters
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Spoof request content by adding random content to the request to avoid detection by AI moderation systems
 * @param request ChatCompletionsRequest
 * @returns ChatCompletionsRequest with spoofed content
 */
export function spoofRequestContent(
  request: ChatCompletionsRequest
): ChatCompletionsRequest {
  return {
    ...request,
    messages: [
      {
        role: "user",
        content: generateRandomContent(),
      },
      ...request.messages,
      {
        role: "user",
        content: generateRandomContent(),
      },
    ],
  };
}
