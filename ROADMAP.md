# Swarm-Review Roadmap

Welcome to the future of **swarm-review**! This roadmap outlines our upcoming development milestones, technical design goals, and feature releases as we progress toward a robust, enterprise-grade `v1.0.0` release.

```mermaid
gantt
    title Swarm-Review Release Timeline
    dateFormat  YYYY-MM-DD
    section Future Milestones
    v0.7.0 (Context Enrichment & AST Navigation) :active, 2026-06-16, 20d
    v0.8.0 (Interactive Feedback & Agent Profiles) : 2026-07-06, 15d
    v1.0.0 (Production Hardening & Cost Controls) : 2026-07-21, 20d
```

---

## 🗺️ Vision & North Star
Our goal is to make **swarm-review** the premier open-source multi-agent PR review tool. It should:
1. **Be Zero-Config by Default**: Work out-of-the-box with a sensible default agent roster.
2. **Read Like a Live Review Session**: Replicate the collaborative nature of human PR reviews.
3. **Be Cost-Conscious**: Support budgeting, caching, and token usage optimization to run cheaply at scale.

---

## 🚀 Milestones

### 📍 Phase 2: Context Enrichment & AST Codebase Navigation (v0.7.0)
*Reviewing changes purely within diff hunks limits the agent's understanding of global state, API signatures, and cross-file side effects.*

#### Proposed Features
- **Import Dependency Resolution**:
  - Parse `import` or `require` statements in changed files to trace relevant dependencies.
  - Pull class, method, or function signatures from imported files as supporting context for the reviewing agents.
- **Reference-Aware Prompting**:
  - Enrich the prompts in `src/prompts.ts` with a "code context" block detailing signature declarations of referenced code.
- **Incremental Codebase Indexing**:
  - Run a lightweight treesitter or regex parser over the repository to build a map of class and function signatures.

> [!TIP]
> To avoid context window explosion, context enrichment will be strictly limited by depth (e.g., depth 1 imports only) and file size constraints.

---

### 📍 Phase 3: Interactive Feedback Loops & Agent Tuning (v0.8.0)
*Currently, the review is a one-way street. Users should be able to clarify questions, dispute findings, or instruct agents to re-evaluate their recommendations.*

#### Proposed Features
- **Conversational Re-Review**:
  - Trigger reviews by replying directly to the principal's comment with a command (e.g., `/swarm-review debate`).
  - Retrieve the comment thread from GitHub, parse the developer's inputs, and feed them back to the debate agent prompt.
- **Custom Agent System Prompts**:
  - Support setting a custom system prompt or "personality" override for each agent.
- **Confidence Calibration**:
  - Introduce fine-grained thresholds to prevent noise and ensure that suggestions are only highlighted if they exceed the target confidence.

---

### 📍 Phase 4: Production Hardening, Cost Controls, & Caching (v1.0.0)
*Preparing swarm-review for enterprise adoption, high-volume repositories, and strict security requirements.*

#### Proposed Features
- **Self-Correction & Schema Retry**:
  - If a model's output fails Zod validation, supply the schema error back to the model for a single-pass repair/retry.
- **Token Budgeting & Auto-Fallback**:
  - Define a strict monetary budget per PR or run.
  - If the budget is close to exhaustion, automatically switch agents to cheaper models (e.g., `gpt-4o-mini`, `gemini-2.0-flash`) or skip the debate rounds.
- **Caching Mechanism**:
  - Store previous reviews of files/commits in GitHub Actions Cache.
  - Skip review/debate cycles for files that have not changed relative to a cached commit.
- **OpenTelemetry & LangSmith Integrations**:
  - Support export of tracing data to help developers debug prompt latency, agent reasoning, and token usage metrics.

---

## 🛠️ Configuration Changes (Proposed Schema)
```yaml
# Additions to .swarm.yml in v1.0.0
budget:
  max_cost_usd: 1.50
  fallback_model: gpt-4o-mini
  
cache:
  enabled: true
  key: swarm-review-${{ github.sha }}

static_analysis:
  enabled: true
  commands:
    - run: npm run lint
```

---

> [!IMPORTANT]
> This roadmap is a living document. We welcome community input and feature requests. Please raise issues on GitHub to discuss changes or suggest improvements to the proposed phases!
