import { buildDebatePrompt } from "../prompts.js";
import { filterDiffForAgent } from "../diff.js";
import type { AgentConfig, DebateTranscript, FileDiff, Finding, ProviderConfig, DiffConfig } from "../types.js";
import { runAgentFindingRound, resolveAgentProviderConfig } from "./shared.js";

export type DebateRoundInput = {
  agents: AgentConfig[];
  diff: FileDiff[];
  initialFindings: Finding[];
  rounds: number;
  providerConfig: ProviderConfig;
  minConfidence: number;
  diffConfig?: DiffConfig;
};

export async function runDebateRounds(input: DebateRoundInput): Promise<DebateTranscript> {
  const transcript: DebateTranscript = {
    rounds: [input.initialFindings],
    agents: input.agents,
  };

  const system =
    "You are a reviewer in the debate phase of a pull request review swarm. Respond to the transcript, challenge weak claims, and add new findings only when justified. Return only JSON.";

  for (let debateRound = 1; debateRound <= input.rounds; debateRound += 1) {
    const currentTranscript: DebateTranscript = {
      rounds: transcript.rounds,
      agents: transcript.agents,
    };

    const roundFindings = await Promise.all(
      input.agents.map((agent) => {
        const providerConfig = resolveAgentProviderConfig(agent, input.providerConfig);
        const filteredDiff = filterDiffForAgent(input.diff, agent);
        if (filteredDiff.length === 0) {
          console.log(`Skipping agent "${agent.name}" in debate round ${debateRound}: no matching files in diff.`);
          return [];
        }

        return runAgentFindingRound({
          providerConfig,
          system,
          prompt: buildDebatePrompt(agent, filteredDiff, currentTranscript, debateRound, input.diffConfig),
          agentName: agent.name,
          idPrefix: `debate-${debateRound}-${agent.name}`,
          minConfidence: input.minConfidence,
        });
      })
    );

    transcript.rounds.push(roundFindings.flat());
  }

  return transcript;
}