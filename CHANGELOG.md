# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed
- `.swarm.yml` now resolves exact environment references (`$ANTHROPIC_API_KEY`) before schema validation and fails clearly when a referenced variable is missing.
- Anthropic endpoint wiring now honors the `api-endpoint` action input in both legacy Anthropic mode and `provider.type: anthropic`, while preserving `provider.config.baseURL` when no override is provided.
- Documentation and examples updated to clarify env reference resolution and Anthropic endpoint override behavior.

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
