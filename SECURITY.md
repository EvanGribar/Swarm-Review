# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| Earlier releases | No |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use [GitHub private vulnerability reporting](https://github.com/EvanGribar/Swarm-Review/security/advisories/new) and include:

- the affected version or commit;
- reproduction steps or a proof of concept;
- the expected security impact; and
- any suggested mitigation.

You should receive an acknowledgment within seven days. Confirmed issues will be coordinated privately until a fix and advisory are ready.

## Security model

swarm-review runs on untrusted pull request diffs in a workflow that can access secrets. The trust boundaries are:

- **Trusted:** workflow files and secrets on the default branch. `.swarm.yml` and `static_analysis` commands are trusted only on same-repo branches — on fork PRs the checkout (and therefore the config) is attacker-controlled.
- **Untrusted:** the PR diff, PR comments, and developer feedback. Diffs are sent to the configured LLM provider and must be treated as data, never instructions. Agent prompts instruct models to ignore instructions embedded in diffs and to describe secret-exposure risks without reproducing credentials.
- **Model output is untrusted:** the principal summary is model-generated markdown posted back to the PR. Posted text is secret-redacted and stripped of markdown images, but reviewers should still treat it like any other contributor comment.
- **`static_analysis` executes shell commands** from `.swarm.yml` with a 2-minute timeout and a 10 MB output cap. Commands are **skipped on fork PRs** unless `static_analysis.allow_forks` is set; report files must stay inside the workspace. Keep commands pinned and minimal, and do not accept config changes from untrusted contributors without review. Public repos should additionally consume a pinned release instead of building the action from the PR checkout, so PR-head `package.json` scripts never run beside secrets.
- **Secrets:** provider API keys are passed via inputs or `$ENV` references resolved at runtime. Registered keys are masked from logs and posted comments. Never commit literal keys, and redact secrets from logs and issue reports.
