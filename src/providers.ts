import { z } from "zod";
import type {
  AnthropicConfig,
  OpenAIConfig,
  OpenRouterConfig,
  OpenClawConfig,
  HermesConfig,
  GroqConfig,
  TogetherConfig,
  MistralConfig,
  CohereConfig,
  PerplexityConfig,
  HyperbolicConfig,
  GeminiConfig,
  CustomProviderConfig,
  ProviderConfig,
} from "./types.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRY_ATTEMPTS = 3;

function shouldRetry(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function addJitter(ms: number): number {
  const jitter = ms * 0.25 * Math.random();
  return ms + jitter;
}

export interface LLMProvider {
  call(system: string, prompt: string, maxTokens?: number): Promise<string>;
}

class AnthropicProvider implements LLMProvider {
  constructor(private config: AnthropicConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.anthropic.com/v1/messages";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            system,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Anthropic request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          content?: Array<{ type: string; text?: string }>;
        } = await response.json();

        return (payload.content ?? [])
          .filter(
            (block): block is { type: string; text: string } =>
              block.type === "text" && typeof block.text === "string"
          )
          .map((block) => block.text)
          .join("");
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Anthropic request failed unexpectedly.");
  }
}

class OpenAIProvider implements LLMProvider {
  constructor(private config: OpenAIConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = this.config.baseURL || "https://api.openai.com/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `OpenAI request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("OpenAI request failed unexpectedly.");
  }
}

class OpenRouterProvider implements LLMProvider {
  constructor(private config: OpenRouterConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://openrouter.ai/api/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
            "HTTP-Referer": "https://github.com/EvanGribar/Swarm-Review",
            "X-Title": "Swarm Review",
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `OpenRouter request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("OpenRouter request failed unexpectedly.");
  }
}

class OpenClawProvider implements LLMProvider {
  constructor(private config: OpenClawConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = `${this.config.baseURL}/chat/completions`;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `OpenClaw request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("OpenClaw request failed unexpectedly.");
  }
}

class HermesProvider implements LLMProvider {
  constructor(private config: HermesConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = `${this.config.baseURL}/chat/completions`;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Hermes request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Hermes request failed unexpectedly.");
  }
}

class GroqProvider implements LLMProvider {
  constructor(private config: GroqConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Groq request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Groq request failed unexpectedly.");
  }
}

class TogetherProvider implements LLMProvider {
  constructor(private config: TogetherConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.together.xyz/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Together request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Together request failed unexpectedly.");
  }
}

class MistralProvider implements LLMProvider {
  constructor(private config: MistralConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.mistral.ai/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Mistral request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Mistral request failed unexpectedly.");
  }
}

class CohereProvider implements LLMProvider {
  constructor(private config: CohereConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.cohere.com/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Cohere request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Cohere request failed unexpectedly.");
  }
}

class PerplexityProvider implements LLMProvider {
  constructor(private config: PerplexityConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.perplexity.ai/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Perplexity request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Perplexity request failed unexpectedly.");
  }
}

class HyperbolicProvider implements LLMProvider {
  constructor(private config: HyperbolicConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://api.hyperbolic.xyz/v1/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Hyperbolic request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Hyperbolic request failed unexpectedly.");
  }
}

class GeminiProvider implements LLMProvider {
  constructor(private config: GeminiConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Gemini request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
        } = await response.json();

        return payload.choices?.[0]?.message?.content ?? "";
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Gemini request failed unexpectedly.");
  }
}

class CustomProvider implements LLMProvider {
  constructor(private config: CustomProviderConfig) {}

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          ...this.config.headers,
        };

        if (!headers["authorization"] && !headers["Authorization"]) {
          headers["authorization"] = `Bearer ${this.config.apiKey}`;
        }

        const response = await fetch(this.config.baseURL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: maxTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(
            `Custom provider request failed with ${response.status}: ${await response.text()}`
          );
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        const payload: {
          choices?: Array<{ message?: { content?: string } }>;
          content?: Array<{ type: string; text?: string }>;
        } = await response.json();

        // Try OpenAI-style response first
        if (payload.choices?.[0]?.message?.content) {
          return payload.choices[0].message.content;
        }

        // Try Anthropic-style response
        if (payload.content) {
          return payload.content
            .filter(
              (block): block is { type: string; text: string } =>
                block.type === "text" && typeof block.text === "string"
            )
            .map((block) => block.text)
            .join("");
        }

        throw new Error("Custom provider response format not recognized");
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.name === "AbortError" || lastError instanceof TypeError) {
          retryableFailure = true;
        }

        if (attempt < MAX_RETRY_ATTEMPTS && retryableFailure) {
          await waitFor(addJitter(retryDelayMs));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Custom provider request failed unexpectedly.");
  }
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config.config);
    case "openai":
      return new OpenAIProvider(config.config);
    case "openrouter":
      return new OpenRouterProvider(config.config);
    case "openclaw":
      return new OpenClawProvider(config.config);
    case "hermes":
      return new HermesProvider(config.config);
    case "groq":
      return new GroqProvider(config.config);
    case "together":
      return new TogetherProvider(config.config);
    case "mistral":
      return new MistralProvider(config.config);
    case "cohere":
      return new CohereProvider(config.config);
    case "perplexity":
      return new PerplexityProvider(config.config);
    case "hyperbolic":
      return new HyperbolicProvider(config.config);
    case "gemini":
      return new GeminiProvider(config.config);
    case "custom":
      return new CustomProvider(config.config);
    default:
      throw new Error(`Unknown provider type: ${(config as { type: string }).type}`);
  }
}
