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
  // 409 Conflict is not transient for LLM APIs; retrying it only burns budget.
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
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

function appendEndpointPath(baseURL: string, suffix: string): string {
  const url = new URL(baseURL);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith(suffix)) {
    url.pathname = `${path}${suffix}`;
  }
  return url.toString();
}

function resolveAnthropicEndpoint(baseURL?: string): string {
  const endpoint = baseURL || "https://api.anthropic.com/v1/messages";
  const path = new URL(endpoint).pathname.replace(/\/+$/, "");
  if (path.endsWith("/messages")) {
    return new URL(endpoint).toString();
  }
  return appendEndpointPath(endpoint, path.endsWith("/v1") ? "/messages" : "/v1/messages");
}

function resolveChatCompletionsEndpoint(baseURL: string): string {
  return appendEndpointPath(baseURL, "/chat/completions");
}

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  calls: number;
};

export const tokenTracker: {
  models: Record<string, ModelUsage>;
  totalCalls: number;
} = {
  models: {},
  totalCalls: 0,
};

export function trackTokens(model: string, input: number, output: number) {
  if (!tokenTracker.models[model]) {
    tokenTracker.models[model] = { inputTokens: 0, outputTokens: 0, calls: 0 };
  }
  tokenTracker.models[model].inputTokens += input;
  tokenTracker.models[model].outputTokens += output;
  tokenTracker.models[model].calls += 1;
  tokenTracker.totalCalls += 1;
}

export function resetTokenTracker() {
  tokenTracker.models = {};
  tokenTracker.totalCalls = 0;
}

// Prices are USD per 1M tokens. Provider pricing changes frequently — treat
// this table as a conservative default and override per-run with
// `budget.model_prices` in `.swarm.yml` when you need exact accounting.
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-opus-4-1": { input: 15.0, output: 75.0 },
  "claude-opus-4-latest": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-latest": { input: 3.0, output: 15.0 },
  "claude-3-7-sonnet-latest": { input: 3.0, output: 15.0 },
  "claude-3-7-sonnet-20250219": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-latest": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-20240620": { input: 3.0, output: 15.0 },
  "claude-3-opus-latest": { input: 15.0, output: 75.0 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4.0 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "gpt-5": { input: 1.25, output: 10.0 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-08-06": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-05-13": { input: 5.0, output: 15.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.6 },
  "o3": { input: 2.0, output: 8.0 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "o1-preview": { input: 15.0, output: 60.0 },
  "o1-mini": { input: 3.0, output: 12.0 },
  "gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "gemini-2.0-pro-exp": { input: 0.0, output: 0.0 },
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
  "gemini-2.0-flash-exp": { input: 0.0, output: 0.0 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "meta-llama/llama-3.3-70b-instruct-turbo": { input: 0.88, output: 0.88 },
  "meta-llama/llama-3.3-70b-instruct": { input: 0.88, output: 0.88 },
  "mistral-large-latest": { input: 2.0, output: 6.0 },
  "mistral-medium-latest": { input: 0.4, output: 2.0 },
  "mistral-small-latest": { input: 0.1, output: 0.3 },
  "command-r-plus": { input: 2.5, output: 10.0 },
  "command-r": { input: 0.15, output: 0.6 },
  "llama-3.1-sonar-small-128k-online": { input: 0.2, output: 0.2 },
  "llama-3.1-sonar-large-128k-online": { input: 1.0, output: 1.0 },
  "kimi-k2.5:cloud": { input: 1.0, output: 3.0 },
  "kimi-k2": { input: 1.0, output: 3.0 },
};

// Merges user-supplied prices (e.g. from `budget.model_prices`) into the
// shared table so strict budget caps can admit models without known pricing.
export function registerCustomModelPrices(prices: Record<string, { input: number; output: number }>): void {
  for (const [model, rates] of Object.entries(prices)) {
    MODEL_COSTS[model] = rates;
    MODEL_COSTS[model.toLowerCase()] = rates;
  }
}

export function getModelCostRates(model: string): { input: number; output: number } | undefined {
  const normalizedModel = model.toLowerCase();
  const baseModel = normalizedModel.split("/").at(-1) ?? normalizedModel;
  const matchedKey = Object.keys(MODEL_COSTS).find(
    (key) => key.toLowerCase() === normalizedModel || key.toLowerCase() === baseModel
  );

  return matchedKey ? MODEL_COSTS[matchedKey] : undefined;
}

export function calculateEstimatedCost(): { cost: number; hasUnknown: boolean } {
  let totalCost = 0;
  let hasUnknown = false;

  for (const [model, usage] of Object.entries(tokenTracker.models)) {
    const rates = getModelCostRates(model);

    if (rates) {
      const modelCost = (usage.inputTokens * rates.input + usage.outputTokens * rates.output) / 1_000_000;
      totalCost += modelCost;
    } else {
      hasUnknown = true;
    }
  }

  return { cost: totalCost, hasUnknown };
}

export interface LLMProvider {
  call(system: string, prompt: string, maxTokens?: number): Promise<string>;
}

type ChatCompletionsUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

type ChatCompletionsPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: ChatCompletionsUsage;
};

function trackChatCompletionsUsage(model: string, usage: ChatCompletionsUsage | undefined): void {
  if (!usage) {
    return;
  }
  trackTokens(
    model,
    usage.prompt_tokens ?? usage.input_tokens ?? 0,
    usage.completion_tokens ?? usage.output_tokens ?? 0
  );
}

// Shared retry/timeout/backoff loop for every provider. Subclasses only
// describe their endpoint, headers, request body, and response parsing.
abstract class BaseProvider implements LLMProvider {
  protected abstract readonly label: string;

  protected abstract resolveEndpoint(): string;
  protected abstract buildHeaders(): Record<string, string>;
  protected abstract buildBody(system: string, prompt: string, maxTokens: number): unknown;
  protected abstract parseText(payload: unknown): string;

  async call(system: string, prompt: string, maxTokens = 4096): Promise<string> {
    const endpoint = this.resolveEndpoint();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      let retryableFailure = false;
      let retryDelayMs = 500 * 2 ** (attempt - 1);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(this.buildBody(system, prompt, maxTokens)),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            retryDelayMs = Math.max(retryDelayMs, retryAfterSeconds * 1000);
          }

          const error = new Error(`${this.label} request failed with ${response.status}: ${await response.text()}`);
          retryableFailure = shouldRetry(response.status);
          throw error;
        }

        return this.parseText(await response.json());
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

    throw lastError ?? new Error(`${this.label} request failed unexpectedly.`);
  }
}

type OpenAICompatibleConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  headers?: Record<string, string>;
};

// Every non-Anthropic provider speaks the OpenAI chat-completions dialect;
// subclasses differ only by endpoint, auth header, and label.
abstract class OpenAICompatibleProvider<C extends OpenAICompatibleConfig = OpenAICompatibleConfig> extends BaseProvider {
  constructor(protected config: C) {
    super();
  }

  protected abstract defaultEndpoint(): string;

  protected resolveEndpoint(): string {
    return resolveChatCompletionsEndpoint(this.config.baseURL || this.defaultEndpoint());
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }

  protected buildBody(system: string, prompt: string, maxTokens: number): unknown {
    return {
      model: this.config.model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    };
  }

  protected parseText(payload: unknown): string {
    const body = payload as ChatCompletionsPayload;
    trackChatCompletionsUsage(this.config.model, body.usage);
    return body.choices?.[0]?.message?.content ?? "";
  }
}

class AnthropicProvider extends BaseProvider {
  protected readonly label = "Anthropic";

  constructor(private config: AnthropicConfig) {
    super();
  }

  protected resolveEndpoint(): string {
    return resolveAnthropicEndpoint(this.config.baseURL);
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-api-key": this.config.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  protected buildBody(system: string, prompt: string, maxTokens: number): unknown {
    return {
      model: this.config.model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: prompt }],
    };
  }

  protected parseText(payload: unknown): string {
    const body = payload as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (body.usage) {
      trackTokens(this.config.model, body.usage.input_tokens ?? 0, body.usage.output_tokens ?? 0);
    }
    return (body.content ?? [])
      .filter((block): block is { type: string; text: string } => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
  }
}

class OpenAIProvider extends OpenAICompatibleProvider {
  protected readonly label = "OpenAI";
  protected defaultEndpoint(): string {
    return "https://api.openai.com/v1/chat/completions";
  }
}

class OpenRouterProvider extends OpenAICompatibleProvider {
  protected readonly label = "OpenRouter";

  constructor(config: OpenRouterConfig) {
    super(config);
  }

  protected defaultEndpoint(): string {
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  protected buildHeaders(): Record<string, string> {
    return {
      ...super.buildHeaders(),
      "HTTP-Referer": "https://github.com/EvanGribar/Swarm-Review",
      "X-Title": "Swarm Review",
    };
  }
}

class OpenClawProvider extends OpenAICompatibleProvider {
  protected readonly label = "OpenClaw";
  protected defaultEndpoint(): string {
    return "http://localhost:11434/v1";
  }
}

class HermesProvider extends OpenAICompatibleProvider {
  protected readonly label = "Hermes";
  protected defaultEndpoint(): string {
    return "http://localhost:8080/v1";
  }
}

class GroqProvider extends OpenAICompatibleProvider {
  protected readonly label = "Groq";
  protected defaultEndpoint(): string {
    return "https://api.groq.com/openai/v1/chat/completions";
  }
}

class TogetherProvider extends OpenAICompatibleProvider {
  protected readonly label = "Together";
  protected defaultEndpoint(): string {
    return "https://api.together.xyz/v1/chat/completions";
  }
}

class MistralProvider extends OpenAICompatibleProvider {
  protected readonly label = "Mistral";
  protected defaultEndpoint(): string {
    return "https://api.mistral.ai/v1/chat/completions";
  }
}

class CohereProvider extends OpenAICompatibleProvider {
  protected readonly label = "Cohere";
  protected defaultEndpoint(): string {
    return "https://api.cohere.com/v1/chat/completions";
  }
}

class PerplexityProvider extends OpenAICompatibleProvider {
  protected readonly label = "Perplexity";
  protected defaultEndpoint(): string {
    return "https://api.perplexity.ai/chat/completions";
  }
}

class HyperbolicProvider extends OpenAICompatibleProvider {
  protected readonly label = "Hyperbolic";
  protected defaultEndpoint(): string {
    return "https://api.hyperbolic.xyz/v1/chat/completions";
  }
}

class GeminiProvider extends OpenAICompatibleProvider {
  protected readonly label = "Gemini";
  protected defaultEndpoint(): string {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
}

class CustomProvider extends OpenAICompatibleProvider<CustomProviderConfig> {
  protected readonly label = "Custom provider";

  protected defaultEndpoint(): string {
    return this.config.baseURL;
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.config.headers,
    };
    if (!headers["authorization"] && !headers["Authorization"]) {
      headers["authorization"] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  protected parseText(payload: unknown): string {
    const body = payload as ChatCompletionsPayload & {
      content?: Array<{ type: string; text?: string }>;
    };
    trackChatCompletionsUsage(this.config.model, body.usage);

    // Try OpenAI-style response first.
    if (body.choices?.[0]?.message?.content) {
      return body.choices[0].message.content;
    }

    // Fall back to Anthropic-style response.
    if (body.content) {
      return body.content
        .filter((block): block is { type: string; text: string } => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("");
    }

    throw new Error("Custom provider response format not recognized");
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
