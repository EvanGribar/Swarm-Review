# Swarm Review

[![CI](https://github.com/EvanGribar/Swarm-Review/actions/workflows/ci.yml/badge.svg)](https://github.com/EvanGribar/Swarm-Review/actions/workflows/ci.yml)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub-Marketplace-555)](https://github.com/marketplace/actions/swarm-review)
[![MIT License](https://img.shields.io/badge/License-MIT-555)](LICENSE)

A GitHub Action for AI-assisted pull request review. Multiple reviewers analyze a diff independently, and a final synthesis step consolidates the findings into one PR comment.

The default `balanced` preset uses three independent reviewers and **no debate rounds**. Optional debate, static analysis, and requirement-aware checks can be enabled separately. Model costs are limited by configurable spending controls.

## What it does

1. Reads the pull request diff and applies configurable scope limits.
2. Runs independent security, performance, and architecture reviews.
3. Validates the structured model outputs before synthesis.
4. Posts one summary to the pull request, with optional check-run behavior.

This is review assistance, **not** a replacement for tests, security review, or human code ownership.

## Quick Start

Add this workflow to your repository:

```yaml
name: swarm-review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  # checks: write  # only needed if you pass `check-run-id` to the action

jobs:
  review:
    if: >-
      github.event_name != 'issue_comment' ||
      (github.event.issue.pull_request &&
      contains(github.event.comment.body, '/swarm-review') &&
      (github.event.comment.author_association == 'OWNER' ||
      github.event.comment.author_association == 'MEMBER' ||
      github.event.comment.author_association == 'COLLABORATOR'))
    runs-on: ubuntu-latest
    concurrency:
      group: swarm-review-${{ github.event.pull_request.number || github.event.issue.number }}
      cancel-in-progress: true
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run swarm-review
        uses: EvanGribar/Swarm-Review@v1
        env:
          # Map each provider key your .swarm.yml references ($NAME) from a secret.
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          anthropic-model: claude-3-5-sonnet-latest
          config-path: .swarm.yml
```

Then add a `.swarm.yml` file at the repository root if you want to customize the swarm.


## Evidence and limits

This repository includes [a methodology](docs/EVALUATION.md), [evaluation results](docs/EVALUATION_RESULTS.md), and [raw result artifacts](artifacts/evaluation/). Its comparison of review configurations used **10 internally authored requirement-violation cases** with repeated trials and a specified model. The results helped determine the default architecture, but do **not** establish real-world accuracy, reliability, or superiority across arbitrary repositories.

## Documentation

- [Detailed configuration, providers, inputs and outputs](docs/USAGE_REFERENCE.md)
- [Optional requirement-aware checks](docs/SPECBRIDGE.md)
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Roadmap](ROADMAP.md)

## Local checks

```sh
npm ci
npm run typecheck
npm test
npm run bundle
```

The Action bundle in `dist/` is committed for GitHub Actions consumers. Optional integrations may require third-party release assets: verify their availability from a fresh checkout before relying on them.
