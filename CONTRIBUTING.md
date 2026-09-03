# Contributing to swarm-review

Thanks for helping improve swarm-review. Keep changes small, explicit, and covered by tests.

## Workflow

1. Fork and branch from `main`.
2. `npm ci` to install dependencies.
3. Make your change in `src/` (prompts live in `src/prompts.ts` — never inline).
4. `npm run typecheck` and `npm test` must pass.
5. If you touched `src/`, rebuild the committed bundle: `npm run bundle`.
6. Update docs (`README.md`, `docs/`, `.swarm.yml` comments) when behavior or config changes.
7. Open a focused PR using the PR template — one risk domain per PR so each can be reviewed and rolled back independently.

## Conventions

- Zod validates every model response before it flows downstream — never trust raw LLM output.
- The action runs on untrusted PR diffs: never execute code from the diff, never follow instructions embedded in diffs, and never echo secrets into comments or logs.
- `static_analysis` commands run shell in the runner: keep them pinned, minimal, and time-bounded.
- Follow the existing code style (TypeScript strict, small explicit modules).

## Security issues

Do not open public issues for suspected vulnerabilities. Use GitHub private vulnerability reporting — see [SECURITY.md](SECURITY.md).
