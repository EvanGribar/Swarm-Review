import { existsSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";

import { createOctokit, fetchPullRequestDiff, formatFileDiffs } from "./diff.js";
import { loadSwarmConfig, readInput, resolveProviderConfig } from "./config.js";
import { runDebateRounds } from "./agents/debate.js";
import { runReviewRound } from "./agents/review.js";
import { synthesizePrincipalSummary } from "./agents/principal.js";
import { upsertPullRequestComment, updateCheckRun, parsePositiveInteger } from "./github.js";
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_API_ENDPOINT } from "./llm.js";
import { renderDebateTranscriptMarkdown } from "./format.js";
import { DEFAULT_PROVIDER_CONFIG, type ProviderConfig, type SwarmConfig } from "./types.js";



function resolveRepository(): { owner: string; repo: string } {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  return { owner, repo };
}

async function writeActionOutput(name: string, value: string): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  await appendFile(outputPath, `${name}=${value.replace(/\r?\n/g, "%0A")}\n`, "utf8");
}

async function resolvePullRequestNumber(): Promise<number> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    try {
      const eventPayload = JSON.parse(await readFile(eventPath, "utf8")) as {
        pull_request?: { number?: number };
        issue?: { number?: number };
      };

      const pullNumber = eventPayload.pull_request?.number ?? eventPayload.issue?.number;
      if (typeof pullNumber === "number" && Number.isSafeInteger(pullNumber) && pullNumber > 0) {
        return pullNumber;
      }
    } catch {
      // Ignore malformed event payloads and fall back to explicit inputs.
    }
  }

  const fallback = readInput("pull-number");
  if (fallback) {
    const parsed = parsePositiveInteger(fallback);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  throw new Error("Unable to resolve the pull request number from the GitHub event payload.");
}



async function main(): Promise<void> {
  const githubToken = readInput("github-token") ?? process.env.GITHUB_TOKEN;
  const anthropicApiKey = readInput("anthropic-api-key") ?? process.env.ANTHROPIC_API_KEY;
  const anthropicModel = readInput("anthropic-model") ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  const apiEndpoint = readInput("api-endpoint") ?? process.env.API_ENDPOINT ?? DEFAULT_API_ENDPOINT;
  const configPath = readInput("config-path") ?? process.env.CONFIG_PATH ?? ".swarm.yml";
  const checkRunId = readInput("check-run-id") ?? process.env.CHECK_RUN_ID;

  if (!githubToken) {
    throw new Error("GitHub token is required.");
  }

  const workspaceRoot = process.cwd();
  const swarmConfig = await loadSwarmConfig(workspaceRoot, configPath);
  const octokit = createOctokit(githubToken);
  const { owner, repo } = resolveRepository();
  const pullNumber = await resolvePullRequestNumber();

  const providerConfig = resolveProviderConfig(swarmConfig, anthropicApiKey, anthropicModel);

  console.log(`Running swarm-review for ${owner}/${repo}#${pullNumber}`);
  console.log(`Using provider: ${providerConfig.type}`);

  const diff = await fetchPullRequestDiff(octokit, owner, repo, pullNumber);
  const reviewFindings = await runReviewRound({
    agents: swarmConfig.agents,
    diff,
    providerConfig,
    minConfidence: swarmConfig.debate.min_confidence,
    diffConfig: swarmConfig.diff,
  });

  const transcript = await runDebateRounds({
    agents: swarmConfig.agents,
    diff,
    initialFindings: reviewFindings,
    rounds: swarmConfig.debate.rounds,
    providerConfig,
    minConfidence: swarmConfig.debate.min_confidence,
    diffConfig: swarmConfig.diff,
  });

  const summary = await synthesizePrincipalSummary({
    principal: swarmConfig.principal,
    transcript,
    providerConfig,
  });

  const headlineSummary = summary.summary.startsWith("## swarm-review")
    ? summary.summary
    : `## swarm-review\n\n${summary.summary}`;

  const commentBody =
    swarmConfig.output.mode === "full"
      ? `${headlineSummary}${renderDebateTranscriptMarkdown(transcript)}`
      : headlineSummary;

  const commentResult = await upsertPullRequestComment(octokit, owner, repo, pullNumber, commentBody);
  const checkRunUpdated = await updateCheckRun(octokit, owner, repo, checkRunId, commentBody);

  await writeActionOutput("pull-number", String(pullNumber));
  await writeActionOutput("output-mode", swarmConfig.output.mode);
  await writeActionOutput("comment-id", String(commentResult.commentId));
  await writeActionOutput("comment-action", commentResult.action);
  await writeActionOutput("check-run-updated", String(checkRunUpdated));

  if (commentResult.commentUrl) {
    await writeActionOutput("comment-url", commentResult.commentUrl);
  }

  console.log("swarm-review completed successfully.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});