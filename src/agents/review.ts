import { buildReviewPrompt } from "../prompts.js";
import type { AgentConfig, FileDiff, Finding, ProviderConfig, DiffConfig } from "../types.js";
import { runAgentFindingRound, resolveAgentProviderConfig } from "./shared.js";

export type ReviewRoundInput = {
  agents: AgentConfig[];
  diff: FileDiff[];
  providerConfig: ProviderConfig;
  minConfidence: number;
  diffConfig?: DiffConfig;
};

export async function runReviewRound(input: ReviewRoundInput): Promise<Finding[]> {
  const system =
    "You are an independent reviewer in the first round of a pull request review swarm. Return only JSON and focus on real, reviewable issues.";

  const findings = await Promise.all(
    input.agents.map((agent) => {
      const providerConfig = resolveAgentProviderConfig(agent, input.providerConfig);

      return runAgentFindingRound({
        providerConfig,
        system,
        prompt: buildReviewPrompt(agent, input.diff, input.diffConfig),
        agentName: agent.name,
        idPrefix: `review-${agent.name}`,
        minConfidence: input.minConfidence,
      });
    })
  );

  return findings.flat();
}