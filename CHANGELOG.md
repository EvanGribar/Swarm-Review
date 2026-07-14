# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- Per-agent `system_prompt` instructions for specialized reviewer personalities while preserving built-in output guardrails.
- Per-agent `min_confidence` thresholds, falling back to the global debate threshold when omitted.
- Trusted conversational re-reviews triggered by exact `/swarm-review` commands on pull requests.
- Strict per-run model budgets with concurrency-safe reservations, successful-call settlement, configurable output caps, and same-provider fallback models.
- Budget-aware degradation that skips unaffordable reviewer calls, defers unsynthesized findings for manual review, and prevents automatic approval after exhaustion.

### Security
- Restrict comment-triggered paid runs to repository owners, organization members, and collaborators.
- Bound developer-feedback context and ignore spoofed managed-comment markers from non-bot users.

### Fixed
- Declared the supported `pull-number` action input and corrected consumer workflow examples to reference the published action.
- Wired the legacy `api-endpoint` input through Anthropic calls instead of silently ignoring it.
- Resolved documented `$ENV_VAR` provider API-key references instead of sending them as literal credentials.
- Corrected legacy provider documentation and action author metadata.

## v0.7.0 - 2026-05-21

### Added
- **Context Enrichment & AST Codebase Navigation**: Traces relative and aliased imports in modified files up to `max_depth` to extract signature declarations of classes, interfaces, types, functions, and variables (excluding method/function bodies).
- **TypeScript Path Aliases & baseUrl Support**: Resolves non-relative import paths with wildcards (e.g., `@/*`, `@utils/*`) and custom `baseUrl` mappings defined in `tsconfig.json`.
- **Path Traversal Security Validation**: Validates all resolved import paths to ensure they reside strictly within the workspace root, preventing path traversal attacks.
- **Fast Codebase Indexing**: Leverages `git ls-files` for extremely fast file discovery when indexing global symbols, automatically respecting `.gitignore` and falling back to manual disk traversal using custom `ignored_dirs`.
- **Import/AST Caching**: Caches resolved import paths, file signatures, and specifiers across agents and debate rounds, avoiding redundant file system operations and parsing.
- **Zod Schema Updates**: Added configuration schema support for `context_enrichment` including `ignored_dirs`.

## v0.6.0 - 2026-05-21

### Added
- **Local Sandbox & Static Analysis Hook**: Run user-specified shell commands (e.g. `npm run lint`, `tsc --noEmit`, `cargo check`) inside the Action runner workspace.
- **Linter & Compiler Parsers**: Parse CLI warnings/errors using:
  - `eslint-json`: For ESLint structured JSON reports (supports both direct stdout and output files via `-o`/`--output-file` regex-inference or an explicit `outputFile` config setting).
  - `regex`: Custom regular expressions with named capture groups to parse logs line-by-line (Zod schema enforces that `regex` pattern is required when parser is set to `"regex"` using a discriminated union).
- **Linter Agent Integration**: Static analysis findings automatically join the round 1 review and serve as ground-truth facts during the debate phase.

## v0.5.0 - 2026-05-19

### Added
- **GitHub Pull Request Reviews (Inline Comments)**: Published accepted findings directly as inline comments on specific modified lines in the pull request.
- **Review Status / PR Decision (Approve vs Request Changes)**: Added a `review_event` input support (`COMMENT`, `APPROVE`, `REQUEST_CHANGES`, and `AUTO`) to submit GitHub reviews and request changes when blocking findings are found.
- **Agent-Specific & Global Include/Exclude Glob Patterns**: Added `include_patterns` and `exclude_patterns` support globally and at the agent level. Reviewers skip running when no matching files are found.
- **Token Usage and Cost Tracking**: Implemented automated tracking of LLM input/output tokens and cost estimation per model for Anthropic, OpenAI, and Gemini models.
- **Action Metadata and Metrics Outputs**: Added inputs (`inline`, `review-event`) and outputs (`total-input-tokens`, `total-output-tokens`, `total-cost`, `total-calls`) to `action.yml`.

## v0.2.0 - 2026-04-21

### Added
- Broader reliability test coverage across model client behavior, GitHub integration helpers, and prompt template contracts.
- Action outputs for pull number, output mode, comment metadata, and check run update status for downstream workflow composition.
- Expanded README operational documentation with architecture, troubleshooting, output examples, and practical limits.

### Changed
- Version bumped from 0.1.1 to 0.2.0 for the feature-complete beta milestone.
- Release work organized into grouped, reviewable pull requests for safer rollout.

### Notes
- This release focuses on confidence, operability, and integration ergonomics ahead of a 1.0 hardening cycle.

## v0.1.1 - 2026-04-21

### Added
- Expanded automated test coverage for agent orchestration flows (shared finding normalization, review fan-out, debate progression, and synthesis schema).
- Added package metadata for repository links, issue tracking, and npm keywords.

### Changed
- Baseline version aligned to 0.1.1 for v0.2.0 development cycle.

## v0.1.0 - 2026-04-21

### Added
- Initial v0.1.x baseline release with core review swarm mechanics (independent review, multi-round debate, principal synthesis).
- GitHub Action integration with comment upsert and check-run reporting.
- YAML configuration via `.swarm.yml`.

## v0.0.2 - 2026-04-21

### Added
- Structured release plan execution in four delivery stages.
- Expanded unit coverage for diff formatting and GitHub helper behavior.

### Changed
- Release metadata updated for the v0.0.2 cycle.

### Notes
- Stage-specific implementation PRs are used to keep risk isolated and review focused.
