import { formatFileDiffs } from "./diff.js";
import type { AgentConfig, DebateTranscript, FileDiff, PrincipalConfig, DiffConfig } from "./types.js";

function baseInstructions(): string {
  return [
    "Return only valid JSON.",
    "Do not include markdown fences, preamble, or commentary.",
    "Treat omitted or truncated diffs as unknown context, not evidence of correctness.",
    "Use plain English claims.",
  ].join(" ");
}

export function buildReviewPrompt(
  agent: AgentConfig,
  diff: FileDiff[],
  diffConfig?: DiffConfig,
  codeContext?: string
): string {
  const parts = [
    `Agent name: ${agent.name}`,
    `Mandate: ${agent.mandate}`,
  ];

  if (codeContext && codeContext.trim()) {
    parts.push(codeContext.trim());
  }

  parts.push(
    `Full diff:\n${formatFileDiffs(diff, diffConfig)}`,
    `Instructions: ${baseInstructions()} Return a JSON array of findings that match the swarm contract. Include id, agent, severity, file, line, claim, confidence, and optional rebuttal_to.`
  );

  return parts.join("\n\n");
}

export function buildDebatePrompt(
  agent: AgentConfig,
  diff: FileDiff[],
  transcript: DebateTranscript,
  debateRound: number,
  diffConfig?: DiffConfig,
  codeContext?: string
): string {
  const parts = [
    `Agent name: ${agent.name}`,
    `Mandate: ${agent.mandate}`,
    `Debate round: ${debateRound}`,
  ];

  if (codeContext && codeContext.trim()) {
    parts.push(codeContext.trim());
  }

  parts.push(
    `Full diff:\n${formatFileDiffs(diff, diffConfig)}`,
    `Prior transcript:\n${JSON.stringify(transcript, null, 2)}`,
    `Instructions: ${baseInstructions()} Return a JSON array of new findings or rebuttals for this round. Each finding should target the existing transcript when relevant via rebuttal_to.`
  );

  return parts.join("\n\n");
}

export function buildPrincipalPrompt(
  principal: PrincipalConfig,
  transcript: DebateTranscript
): string {
  return [
    `Principal mandate: ${principal.mandate}`,
    `Full debate transcript:\n${JSON.stringify(transcript, null, 2)}`,
    `Instructions: ${baseInstructions()} Return a JSON object matching the principal summary contract with agreements, disputes, final_calls, and summary. The summary field must be the markdown block that should be posted to GitHub.`,
  ].join("\n\n");
}