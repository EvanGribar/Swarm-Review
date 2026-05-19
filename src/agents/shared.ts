import { z } from "zod";

import { callLLMStructured, normalizeFinding } from "../llm.js";
import { RawFindingSchema, type Finding, type RawFinding, type ProviderConfig, type AgentConfig } from "../types.js";

const RawFindingArraySchema = z.array(RawFindingSchema);

export type AgentRoundOptions = {
  providerConfig: ProviderConfig;
  system: string;
  prompt: string;
  agentName: string;
  idPrefix: string;
  minConfidence: number;
};

export function resolveAgentProviderConfig(
  agent: AgentConfig,
  baseConfig: ProviderConfig
): ProviderConfig {
  if (!agent.model) {
    return baseConfig;
  }
  return {
    type: baseConfig.type,
    config: {
      ...baseConfig.config,
      model: agent.model,
    },
  } as ProviderConfig;
}

export async function runAgentFindingRound(options: AgentRoundOptions): Promise<Finding[]> {
  const rawFindings = await callLLMStructured<RawFinding[]>(
    options.providerConfig,
    options.system,
    options.prompt,
    RawFindingArraySchema
  );

  return rawFindings
    .map((finding, index) => normalizeFinding(finding, options.agentName, `${options.idPrefix}-${index + 1}`))
    .filter((finding) => finding.confidence >= options.minConfidence);
}