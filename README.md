# swarm-review

swarm-review is a GitHub Action that turns one pull request into a multi-agent review session.

Each configured agent reads the diff independently, flags issues, and then enters a structured debate with the rest of the swarm. A principal agent reads the full transcript and posts the final PR comment, so the output looks like a real engineering review instead of a single flat model response.

## Why it exists

Most AI review tools give you one opinion. swarm-review gives you a review process.

- Different agents can specialize in security, performance, architecture, or whatever your team needs.
- Agents can challenge each other before the final comment is posted.
- Teams can choose whether to show only the final outcome or the full debate transcript.

## How it works

1. The action fetches the pull request diff from GitHub.
2. Every agent performs an independent first-pass review in parallel.
3. The agents debate each other for the configured number of rounds.
4. The principal agent synthesizes the transcript into a final summary.
5. The action updates the PR comment and, optionally, the check run.

## Architecture

swarm-review uses a strict three-stage pipeline:

1. Review stage (parallel): each agent reviews the same diff independently.
2. Debate stage (round-based): agents receive the shared transcript and can rebut or reinforce findings.
3. Principal stage: one synthesis pass turns the transcript into a final call.

All model output is validated with Zod before it can flow to the next stage.
If an output is malformed, the run fails fast instead of silently accepting invalid content.

## Quick Start

Add this workflow to your repository:

```yaml
name: swarm-review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run swarm-review
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          anthropic-model: claude-3-5-sonnet-latest
          config-path: .swarm.yml
```

Then add a `.swarm.yml` file at the repository root if you want to customize the swarm.

## Configuration

If `.swarm.yml` is missing, the action uses the default config bundled with this repository.

```yaml
agents:
  - name: security
    mandate: >
      Review for security vulnerabilities. Look for injection risks, exposed secrets,
      broken auth, insecure defaults, and unsafe data handling.
    include_patterns: ["src/**"]
    exclude_patterns: ["*.spec.ts"]

  - name: performance
    mandate: >
      Review for performance issues. Look for N+1 queries, unnecessary re-renders,
      expensive operations in hot paths, and missing pagination.

  - name: architecture
    mandate: >
      Review for architectural concerns. Look for separation of concerns violations,
      tight coupling, naming inconsistency, and patterns that do not fit the codebase.

  - name: dx
    mandate: >
      Review for developer experience. Look for missing tests, outdated docs,
      unclear variable names, and changes that will be hard to maintain.

debate:
  rounds: 2
  min_confidence: 0.6

principal:
  mandate: >
    You are the principal engineer. Read the full debate and make final calls.
    Be direct. Show your reasoning. Surface genuine disagreements clearly.

output:
  mode: outcome
  inline: false
  review_event: COMMENT

diff:
  max_files: 80
  max_patch_chars_per_file: 12000
  max_total_chars: 180000
  include_patterns: []
  exclude_patterns: []
```

### Output modes

- `outcome`: posts only the principal summary.
- `full`: posts the principal summary plus the full round-by-round transcript.

Example (`outcome`):

```text
## swarm-review

security flagged src/api/users.ts:47 - raw user input is passed into query construction.
principal: blocking until this path uses parameterized queries.
```

Example (`full`):

```text
## swarm-review

security flagged src/api/users.ts:47 - raw user input is passed into query construction.
principal: blocking until this path uses parameterized queries.

### Debate Transcript
#### Round 1
- [BLOCKING] security - src/api/users.ts:47
  - Raw user input is passed into query construction.

#### Round 2
- [WARNING] performance - src/api/users.ts:47
  - Endpoint traffic is low, but query safety still should be fixed.
```

### Config fields

- `provider`: optional LLM provider configuration (see Provider Configuration below).
- `agents`: list of reviewer agents, each with a `name`, `mandate`, optional `model`, and optional agent-level file filters:
  - `agents[].include_patterns`: glob patterns of files this agent should review.
  - `agents[].exclude_patterns`: glob patterns of files this agent should ignore.
- `debate.rounds`: how many debate rounds to run after the first-pass review.
- `debate.min_confidence`: findings below this threshold are filtered out.
- `principal.mandate`: instructions for the synthesis agent.
- `output.mode`: controls whether the transcript is included in the PR comment.
- `output.inline`: whether to publish accepted findings as inline GitHub review comments.
- `output.review_event`: GitHub review submission event status (`COMMENT`, `APPROVE`, `REQUEST_CHANGES`, or `AUTO`).
- `diff.max_files`: maximum number of files to include in the diff sent to agents.
- `diff.max_patch_chars_per_file`: maximum characters per file patch before truncation.
- `diff.max_total_chars`: maximum total characters across all files.
- `diff.include_patterns`: global list of glob patterns to limit review files (e.g., `["src/**"]`).
- `diff.exclude_patterns`: global list of glob patterns to exclude files from review (e.g., `["\\.lock$", "package-lock\\.json"]`).

## Provider Configuration

swarm-review supports multiple LLM providers through the `provider` field in `.swarm.yml`. If not specified, the action falls back to the legacy `anthropic-api-key` input.

### Anthropic (default)

```yaml
provider:
  type: anthropic
  config:
    apiKey: $ANTHROPIC_API_KEY  # Or use a GitHub secret reference
    model: claude-3-5-sonnet-latest
```

### OpenAI

```yaml
provider:
  type: openai
  config:
    apiKey: $OPENAI_API_KEY
    model: gpt-4o
    baseURL: https://api.openai.com/v1  # optional, defaults to OpenAI
```

### OpenRouter

```yaml
provider:
  type: openrouter
  config:
    apiKey: $OPENROUTER_API_KEY
    model: anthropic/claude-3.5-sonnet
```

### OpenClaw

OpenClaw is an open-source autonomous AI agent that can be used as a provider via its OpenAI-compatible API. It requires a running OpenClaw gateway instance.

```yaml
provider:
  type: openclaw
  config:
    apiKey: $OPENCLAW_GATEWAY_TOKEN
    model: kimi-k2.5:cloud
    baseURL: http://localhost:11434/v1
```

**Note:** OpenClaw requires a gateway to be running. The default `baseURL` points to the local Ollama/OpenClaw gateway. Adjust the `baseURL` if your gateway is hosted elsewhere.

### Hermes Agent

Hermes Agent is a self-improving AI agent built by Nous Research that supports OpenAI-compatible API endpoints. It can work with local models, cloud APIs, and multi-provider routers.

```yaml
provider:
  type: hermes
  config:
    apiKey: $HERMES_API_KEY
    model: nous-hermes-3-llama-3.1-405b
    baseURL: http://localhost:8080/v1
```

**Note:** Hermes requires a running instance. The default `baseURL` points to the local Hermes gateway. Adjust the `baseURL` if your Hermes instance is hosted elsewhere.

### Groq

Groq provides ultra-low latency inference using their LPU (Language Processing Unit) technology. It's ideal for speed-sensitive applications requiring fast response times.

```yaml
provider:
  type: groq
  config:
    apiKey: $GROQ_API_KEY
    model: llama-3.3-70b-versatile
```

**Note:** Groq offers industry-leading latency for compatible models. Visit [Groq's documentation](https://console.groq.com/docs/models) for available models.

### Together AI

Together AI specializes in high-scale open-source LLMs with excellent price/performance. It supports fine-tuning and provides sub-100ms response times.

```yaml
provider:
  type: together
  config:
    apiKey: $TOGETHER_API_KEY
    model: meta-llama/Llama-3.3-70B-Instruct-Turbo
```

**Note:** Together AI is optimized for open-source models like Llama. Check their [model catalog](https://api.together.xyz/models) for available options.

### Mistral AI

Mistral AI is a leader in open-weight model APIs, providing access to their Mistral models through an OpenAI-compatible endpoint.

```yaml
provider:
  type: mistral
  config:
    apiKey: $MISTRAL_API_KEY
    model: mistral-large-latest
```

**Note:** Mistral offers both open-weight and proprietary models. See their [API documentation](https://docs.mistral.ai/) for model options.

### Cohere

Cohere provides enterprise-grade language models with an OpenAI-compatible API. Their models are optimized for business applications including text generation, summarization, and analysis.

```yaml
provider:
  type: cohere
  config:
    apiKey: $COHERE_API_KEY
    model: command-r-plus
```

**Note:** Cohere's Compatibility API allows seamless integration with OpenAI-based applications. Visit [Cohere's documentation](https://docs.cohere.com/docs/compatibility-api) for available models.

### Perplexity

Perplexity offers search-enhanced AI models that combine language understanding with real-time web search capabilities, providing up-to-date and factual responses.

```yaml
provider:
  type: perplexity
  config:
    apiKey: $PERPLEXITY_API_KEY
    model: llama-3.1-sonar-small-128k-online
```

**Note:** Perplexity models include web search capabilities for more accurate and current information. See their [API documentation](https://docs.perplexity.ai/docs/getting-started/quickstart) for model options.

### Hyperbolic

Hyperbolic provides cost-optimized GPU inference for open-source models through an OpenAI-compatible API, offering competitive pricing for high-scale deployments.

```yaml
provider:
  type: hyperbolic
  config:
    apiKey: $HYPERBOLIC_API_KEY
    model: meta-llama/Llama-3.3-70B-Instruct
```

**Note:** Hyperbolic specializes in affordable on-demand GPU inference. Check their [REST API documentation](https://docs.hyperbolic.xyz/docs/rest-api) for available models.

### Gemini

Gemini is Google's family of multimodal AI models, including the experimental Gemini 2.0 Flash model with fast inference and strong reasoning capabilities.

```yaml
provider:
  type: gemini
  config:
    apiKey: $GEMINI_API_KEY
    model: gemini-2.0-flash-exp
```

**Note:** Gemini uses the Google AI API with the API key passed as a query parameter. Visit [Google AI Studio](https://makersuite.google.com/app/apikey) to get an API key and check their [documentation](https://ai.google.dev/gemini-api/docs) for available models.

### Custom Provider

For any OpenAI-compatible API:

```yaml
provider:
  type: custom
  config:
    apiKey: $CUSTOM_API_KEY
    model: your-model-name
    baseURL: https://your-provider.com/v1
    headers:
      X-Custom-Header: value
```

### Legacy Mode

If you don't configure a provider in `.swarm.yml`, the action uses the legacy inputs:

```yaml
- name: Run swarm-review
  uses: ./
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    anthropic-model: claude-3-5-sonnet-latest
```

This is equivalent to configuring:

```yaml
provider:
  type: anthropic
  config:
    apiKey: $ANTHROPIC_API_KEY
    model: claude-instruct-beta-5b
```

## Action Inputs

- `github-token`: GitHub token with permission to comment on pull requests.
- `provider`: LLM provider configuration (see Provider Configuration above).
- `config-path`: optional path to the swarm config file.
- `check-run-id`: optional existing check run ID to update after the review.
- `inline`: optional override to post findings as inline review comments (`true` or `false`).
- `review-event`: optional override for GitHub review event status (`COMMENT`, `APPROVE`, `REQUEST_CHANGES`, or `AUTO`).

## Action Outputs

- `pull-number`: pull request number processed by this run.
- `output-mode`: active render mode (`outcome` or `full`).
- `comment-id`: numeric ID of the created or updated PR comment.
- `comment-action`: either `created` or `updated`.
- `comment-url`: URL of the created or updated PR comment when available.
- `check-run-updated`: `true` when a valid check run ID was provided and updated.
- `total-input-tokens`: total input tokens consumed by LLM calls.
- `total-output-tokens`: total output tokens consumed by LLM calls.
- `total-cost`: estimated total cost of LLM calls in USD.
- `total-calls`: total number of LLM calls executed.

## Example Result

The final comment is designed to read like a human review thread:

```text
## swarm-review

security flagged src/api/users.ts:47 — raw user input is passed into a query string.
performance disagreed — the path is currently low traffic but still has avoidable overhead.
principal: the security concern is valid. Use a parameterized query.
```

## Local Development

```bash
npm install
npm run build
npm test
```

## Troubleshooting

- Missing token or API key:
  - Ensure `github-token` and `anthropic-api-key` are passed to the action.
- The action cannot resolve pull request number:
  - Confirm the workflow runs on pull request events, or provide `pull-number` through environment input.
- LLM response parsing failures:
  - The run fails when the model output is not valid JSON matching the schema.
  - Retry with a stricter model instruction in your agent mandates or principal mandate.
- Check run was not updated:
  - `check-run-id` must be a positive integer string.

## Practical Limits

- Large diffs increase token usage and can reduce claim quality due to context compression.
- High agent counts and many debate rounds increase runtime and cost linearly.
- Recommended starting point:
  - 3-5 agents
  - 1-2 debate rounds
  - confidence threshold of 0.6-0.75

Tune these values based on repository size and expected review depth.

## Release Process

Releases are delivered in stage-specific pull requests so each risk domain is reviewed independently. This keeps reviews focused and makes rollback decisions straightforward. For example, a release cycle typically includes:

1. Stability and safety hardening.
2. Diff scaling and runtime reliability.
3. Coverage expansion for key helpers.
4. Documentation and release metadata.


## Project Layout

- `src/types.ts`: shared schemas and data contracts.
- `src/config.ts`: config loading and validation.
- `src/diff.ts`: pull request diff fetching and formatting.
- `src/prompts.ts`: all LLM prompt templates.
- `src/agents/`: review, debate, and synthesis rounds.
- `src/index.ts`: action entrypoint.

## Notes

The implementation is intentionally small and explicit. The system is built around a strict data contract so agent output can be validated before it is passed to the next stage.