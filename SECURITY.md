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

- **Trusted:** `.swarm.yml` config, `static_analysis` commands, workflow files, and secrets on the default branch. For `issue_comment` re-reviews, keep the checkout on the trusted default branch — never check out and execute PR-head code in a secrets-bearing workflow.
- **Untrusted:** the PR diff, PR comments, and developer feedback. Diffs are sent to the configured LLM provider and must be treated as data, never instructions. Agent prompts instruct models to ignore instructions embedded in diffs and to describe secret-exposure risks without reproducing credentials.
- **Model output is untrusted:** the principal summary is model-generated markdown posted back to the PR. Reviewers should treat it like any other contributor comment.
- **`static_analysis` executes shell commands** from `.swarm.yml` with a 2-minute timeout and a 10 MB output cap. Keep commands pinned and minimal, and do not accept config changes from untrusted contributors without review.
- **Secrets:** provider API keys are passed via inputs or `$ENV` references resolved at runtime. Never commit literal keys, and redact secrets from logs and issue reports.
