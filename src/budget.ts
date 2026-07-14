import { Buffer } from "node:buffer";

import { getModelCostRates } from "./providers.js";
import type { BudgetConfig, ProviderConfig } from "./types.js";

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

type BudgetState = {
  config?: BudgetConfig;
  committedUpperBoundUsd: number;
  fallbackCalls: number;
  skippedCalls: number;
};

const budgetState: BudgetState = {
  committedUpperBoundUsd: 0,
  fallbackCalls: 0,
  skippedCalls: 0,
};

export function configureBudget(config: BudgetConfig | undefined): void {
  budgetState.config = config;
  budgetState.committedUpperBoundUsd = 0;
  budgetState.fallbackCalls = 0;
  budgetState.skippedCalls = 0;
}

export function getBudgetStatus(): Readonly<BudgetState> & { exhausted: boolean } {
  return {
    ...budgetState,
    exhausted: budgetState.skippedCalls > 0,
  };
}

function withModel(config: ProviderConfig, model: string): ProviderConfig {
  return {
    ...config,
    config: {
      ...config.config,
      model,
    },
  } as ProviderConfig;
}

export function estimateCallUpperBoundUsd(
  model: string,
  system: string,
  prompt: string,
  maxOutputTokens: number
): number | undefined {
  const rates = getModelCostRates(model);
  if (!rates) {
    return undefined;
  }

  // Byte length is a conservative upper bound for BPE token counts.
  const maxInputTokens = Buffer.byteLength(system, "utf8") + Buffer.byteLength(prompt, "utf8");
  return (maxInputTokens * rates.input + maxOutputTokens * rates.output) / 1_000_000;
}

export function reserveBudgetedCall(
  providerConfig: ProviderConfig,
  system: string,
  prompt: string,
  requestedMaxTokens: number
): { providerConfig: ProviderConfig; maxTokens: number; reservedUsd: number } {
  const config = budgetState.config;
  if (!config) {
    return { providerConfig, maxTokens: requestedMaxTokens, reservedUsd: 0 };
  }

  const maxTokens = Math.min(requestedMaxTokens, config.max_output_tokens);
  const primaryModel = providerConfig.config.model;
  const candidates = [
    { config: providerConfig, model: primaryModel, fallback: false },
    ...(config.fallback_model && config.fallback_model !== primaryModel
      ? [{ config: withModel(providerConfig, config.fallback_model), model: config.fallback_model, fallback: true }]
      : []),
  ];

  for (const candidate of candidates) {
    const reservedUsd = estimateCallUpperBoundUsd(candidate.model, system, prompt, maxTokens);
    if (reservedUsd === undefined) {
      continue;
    }

    if (budgetState.committedUpperBoundUsd + reservedUsd <= config.max_cost_usd) {
      budgetState.committedUpperBoundUsd += reservedUsd;
      if (candidate.fallback) {
        budgetState.fallbackCalls += 1;
        console.log(
          `::notice::Budget guard selected fallback model ${candidate.model} for this call.`
        );
      }
      return { providerConfig: candidate.config, maxTokens, reservedUsd };
    }
  }

  budgetState.skippedCalls += 1;
  throw new BudgetExceededError(
    `LLM call skipped: the configured $${config.max_cost_usd.toFixed(4)} budget cannot cover another call. ` +
      `Committed worst-case spend is $${budgetState.committedUpperBoundUsd.toFixed(4)}.`
  );
}
