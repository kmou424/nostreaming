import axios, { type AxiosInstance } from "axios";
import { logger } from "../../logger";
import {
  ChatCompletionsResponseSchema,
  ModelsListResponseSchema,
  OpenAIErrorSchema,
  type ChatCompletionsRequest,
  type ChatCompletionsResponse,
  type ModelsListResponse,
} from "../../schemas/openai";
import { Result } from "../../type/result";
import {
  type ModelsList,
  type ProviderClient,
  type TypedProviderConfig,
} from "../types";

/**
 * OpenAI Provider Client implementation
 */
export class OpenAIProviderClient implements ProviderClient {
  private name: string;
  private config: TypedProviderConfig;
  private cachedModels: ModelsList | null = null;
  private client: AxiosInstance;

  constructor(name: string, config: TypedProviderConfig) {
    this.name = name;
    this.config = config;

    this.client = axios.create({
      baseURL: config.endpoint,
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
    });
  }

  getName(): string {
    return this.name;
  }

  async create(): Promise<Result<void>> {
    logger.debug("Creating OpenAI provider", {
      name: this.name,
      endpoint: this.config.endpoint,
    });
    try {
      // Fetch models list to validate endpoint and API key
      let models: ModelsList | null | undefined;
      let err: Error | null = null;
      ({ models, err } = await this.fetchModels());
      if (err || !models) {
        logger.error("Failed to validate OpenAI provider", {
          name: this.name,
          error: err?.message,
        });
        return Result<void>(err || new Error("Failed to fetch models"));
      }

      // Cache the models list
      this.cachedModels = models;
      logger.debug("OpenAI provider created successfully", {
        name: this.name,
        modelCount: this.cachedModels.length,
      });
      return Result<void>(undefined as void);
    } catch (error) {
      logger.error("Unexpected error creating OpenAI provider", {
        name: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return Result<void>(
        error instanceof Error
          ? error
          : new Error(`Failed to create OpenAI provider: ${String(error)}`)
      );
    }
  }

  async completion(
    request: ChatCompletionsRequest
  ): Promise<Result<ChatCompletionsResponse>> {
    logger.debug("Sending completion request to OpenAI", {
      name: this.name,
      model: request.model,
    });
    try {
      const response = await this.client.post<unknown>(
        "/chat/completions",
        request,
        {
          signal: AbortSignal.timeout(600000),
        }
      );

      const { err, data } = this.validateCompletion(response, request.model);
      if (err || !data) {
        return Result<ChatCompletionsResponse>(
          new Error(`Failed to validate completion response: ${err?.message}`)
        );
      }

      logger.debug("OpenAI completion request succeeded", {
        name: this.name,
        model: request.model,
      });
      return Result<ChatCompletionsResponse>(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message;
        logger.error("OpenAI API error", {
          name: this.name,
          model: request.model,
          status: error.response?.status,
          error: errorMessage,
        });
        return Result<ChatCompletionsResponse>(
          new Error(
            `OpenAI API error: ${
              error.response?.status ?? "unknown"
            } - ${errorMessage}`
          )
        );
      }
      logger.error("Unexpected error in OpenAI completion", {
        name: this.name,
        model: request.model,
        error: error instanceof Error ? error.message : String(error),
      });
      return Result<ChatCompletionsResponse>(
        error instanceof Error
          ? error
          : new Error(`Failed to create completion: ${String(error)}`)
      );
    }
  }

  async models(): Promise<Result<ModelsList>> {
    // Return cached models if available
    if (this.cachedModels) {
      return Result<ModelsList>(this.cachedModels);
    }

    // If no cache, try to fetch
    return this.fetchModels();
  }

  async refreshModels(): Promise<Result<ModelsList>> {
    logger.debug("Refreshing OpenAI models", { name: this.name });
    let models: ModelsList | null | undefined;
    let err: Error | null = null;
    ({ models, err } = await this.fetchModels());
    if (!err && models) {
      this.cachedModels = models;
      logger.debug("OpenAI models refreshed", {
        name: this.name,
        modelCount: this.cachedModels.length,
      });
    } else {
      logger.error("Failed to refresh OpenAI models", {
        name: this.name,
        error: err?.message,
      });
    }
    return err ? Result<ModelsList>(err) : Result<ModelsList>(models!);
  }

  /**
   * Fetch models list from OpenAI API
   * @private
   */
  private async fetchModels(): Promise<Result<ModelsList>> {
    logger.debug("Fetching models from OpenAI", { name: this.name });
    try {
      const response = await this.client.get<unknown>("/models");

      const { err, models } = this.validateModels(response);
      if (err || !models || !models.data) {
        return Result<ModelsList>(
          new Error(`Failed to validate models response: ${err?.message}`)
        );
      }

      logger.debug("Successfully fetched models from OpenAI", {
        name: this.name,
        modelCount: models.data.length,
      });
      return Result<ModelsList>(models.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message;
        logger.error("Failed to fetch models from OpenAI", {
          name: this.name,
          status: error.response?.status,
          error: errorMessage,
        });
        return Result<ModelsList>(
          new Error(
            `OpenAI API error: ${
              error.response?.status ?? "unknown"
            } - ${errorMessage}`
          )
        );
      }
      logger.error("Unexpected error fetching models from OpenAI", {
        name: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return Result<ModelsList>(
        error instanceof Error
          ? error
          : new Error(`Failed to fetch models: ${String(error)}`)
      );
    }
  }

  /**
   * Validate completion response
   * Checks in order: error response body -> non-2xx status -> Zod validation
   * @private
   */
  private validateCompletion(
    response: { status: number; data: unknown },
    model: string
  ): Result<ChatCompletionsResponse> {
    // Check 1: Non-2xx status code with error response body
    if (response.status < 200 || response.status >= 300) {
      const errorCheck = OpenAIErrorSchema.safeParse(response.data);
      if (errorCheck.success) {
        const errorData = errorCheck.data.error;
        logger.error("OpenAI API returned error status with error body", {
          name: this.name,
          model,
          status: response.status,
          errorMessage: errorData.message,
          errorType: errorData.type,
          errorCode: errorData.code,
        });
        return Result<ChatCompletionsResponse>(
          new Error(
            `OpenAI API error (${response.status}): ${errorData.type} - ${
              errorData.message
            }${errorData.code ? ` (code: ${errorData.code})` : ""}`
          )
        );
      }
      // Non-standard error format
      const errorMessage =
        typeof response.data === "object" && response.data !== null
          ? JSON.stringify(response.data)
          : String(response.data);
      logger.error("OpenAI API returned non-2xx status code", {
        name: this.name,
        model,
        status: response.status,
        error: errorMessage,
      });
      return Result<ChatCompletionsResponse>(
        new Error(
          `OpenAI API returned status ${response.status}: ${errorMessage}`
        )
      );
    }

    // Check 2: Response body contains error field (some proxies return 200 with error)
    const errorCheck = OpenAIErrorSchema.safeParse(response.data);
    if (errorCheck.success) {
      const errorData = errorCheck.data.error;
      logger.error("OpenAI API returned error response in body", {
        name: this.name,
        model,
        errorMessage: errorData.message,
        errorType: errorData.type,
        errorCode: errorData.code,
      });
      return Result<ChatCompletionsResponse>(
        new Error(
          `OpenAI API error: ${errorData.type} - ${errorData.message}${
            errorData.code ? ` (code: ${errorData.code})` : ""
          }`
        )
      );
    }

    // Check 3: Validate response structure with Zod
    const respCheck = ChatCompletionsResponseSchema.safeParse(response.data);
    if (!respCheck.success) {
      logger.error("Invalid OpenAI response format", {
        name: this.name,
        model,
        errors: respCheck.error.issues,
        responseData: JSON.stringify(response.data),
      });
      return Result<ChatCompletionsResponse>(
        new Error(
          `Invalid response format from OpenAI API: ${respCheck.error.message}`
        )
      );
    }

    return Result<ChatCompletionsResponse>(respCheck.data);
  }

  /**
   * Validate models response
   * Checks in order: error response body -> non-2xx status -> Zod validation
   * @private
   */
  private validateModels(response: {
    status: number;
    data: unknown;
  }): Result<ModelsListResponse> {
    // Check 1: Non-2xx status code with error response body
    if (response.status < 200 || response.status >= 300) {
      const errorCheck = OpenAIErrorSchema.safeParse(response.data);
      if (errorCheck.success) {
        const errorData = errorCheck.data.error;
        logger.error("OpenAI API returned error status with error body", {
          name: this.name,
          status: response.status,
          errorMessage: errorData.message,
          errorType: errorData.type,
          errorCode: errorData.code,
        });
        return Result<ModelsListResponse>(
          new Error(
            `OpenAI API error (${response.status}): ${errorData.type} - ${
              errorData.message
            }${errorData.code ? ` (code: ${errorData.code})` : ""}`
          )
        );
      }
      // Non-standard error format
      const errorMessage =
        typeof response.data === "object" && response.data !== null
          ? JSON.stringify(response.data)
          : String(response.data);
      logger.error("OpenAI API returned non-2xx status code", {
        name: this.name,
        status: response.status,
        error: errorMessage,
      });
      return Result<ModelsListResponse>(
        new Error(
          `OpenAI API returned status ${response.status}: ${errorMessage}`
        )
      );
    }

    // Check 2: Response body contains error field (some proxies return 200 with error)
    const errorCheck = OpenAIErrorSchema.safeParse(response.data);
    if (errorCheck.success) {
      const errorData = errorCheck.data.error;
      logger.error("OpenAI API returned error response in body", {
        name: this.name,
        errorMessage: errorData.message,
        errorType: errorData.type,
        errorCode: errorData.code,
      });
      return Result<ModelsListResponse>(
        new Error(
          `OpenAI API error: ${errorData.type} - ${errorData.message}${
            errorData.code ? ` (code: ${errorData.code})` : ""
          }`
        )
      );
    }

    // Check 3: Validate response structure with Zod
    const respCheck = ModelsListResponseSchema.safeParse(response.data);
    if (!respCheck.success) {
      logger.error("Invalid OpenAI models response format", {
        name: this.name,
        errors: respCheck.error.issues,
        responseData: JSON.stringify(response.data),
      });
      return Result<ModelsListResponse>(
        new Error(
          `Invalid response format from OpenAI API: ${respCheck.error.message}`
        )
      );
    }

    return Result<ModelsListResponse>(respCheck.data);
  }
}
