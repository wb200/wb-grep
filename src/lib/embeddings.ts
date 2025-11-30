import {
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_RETRIES,
  DEFAULT_OLLAMA_TIMEOUT,
  DEFAULT_OLLAMA_URL,
  MAX_RETRY_DELAY_MS,
  VECTOR_DIMENSIONS,
} from "./constants";

export interface EmbeddingConfig {
  model: string;
  baseURL: string;
  dimensions: number;
  timeout: number;
  retries: number;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = "RetryError";
  }
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: DEFAULT_OLLAMA_MODEL,
  baseURL: DEFAULT_OLLAMA_URL,
  dimensions: VECTOR_DIMENSIONS,
  timeout: DEFAULT_OLLAMA_TIMEOUT,
  retries: DEFAULT_OLLAMA_RETRIES,
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OllamaEmbedder {
  private config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isAbortError =
          lastError.name === "AbortError" ||
          lastError.message.includes("aborted");
        const isNetworkError =
          lastError.message.includes("ECONNREFUSED") ||
          lastError.message.includes("ECONNRESET") ||
          lastError.message.includes("fetch failed");

        if (attempt < this.config.retries && (isAbortError || isNetworkError)) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
          await sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw new RetryError(
      `${operationName} failed after ${this.config.retries} attempts`,
      this.config.retries,
      lastError,
    );
  }

  async embed(text: string): Promise<number[]> {
    return this.withRetry(async () => {
      const response = await this.fetchWithTimeout(
        `${this.config.baseURL}/api/embeddings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.config.model,
            prompt: text,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OllamaEmbeddingResponse;
      return data.embedding;
    }, "embed");
  }

  async batchEmbed(texts: string[], concurrency = 8): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const queue = texts.map((text, index) => ({ text, index }));
    const errors: Array<{ index: number; error: Error }> = [];

    const workers = Array.from(
      { length: Math.min(concurrency, texts.length) },
      async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;

          try {
            results[item.index] = await this.embed(item.text);
          } catch (error) {
            errors.push({
              index: item.index,
              error: error instanceof Error ? error : new Error(String(error)),
            });
            results[item.index] = Array(this.config.dimensions).fill(0);
          }
        }
      },
    );

    await Promise.all(workers);

    if (errors.length > 0 && errors.length === texts.length) {
      throw new Error(
        `All ${errors.length} embeddings failed. First error: ${errors[0].error.message}`,
      );
    }

    return results;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseURL}/api/tags`,
        { method: "GET" },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async checkModel(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseURL}/api/tags`,
        { method: "GET" },
      );

      if (!response.ok) return false;

      const data = (await response.json()) as OllamaTagsResponse;
      const modelBase = this.config.model.split(":")[0];

      return (
        data.models?.some(
          (m) => m.name === this.config.model || m.name.startsWith(modelBase),
        ) ?? false
      );
    } catch {
      return false;
    }
  }

  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }
}
