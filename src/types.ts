import { z } from "zod";

export const SeveritySchema = z.enum(["blocking", "warning", "suggestion"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingBodySchema = z.object({
  agent: z.string().min(1),
  severity: SeveritySchema,
  file: z.string().min(1),
  line: z.number().int().positive(),
  claim: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rebuttal_to: z.string().min(1).optional(),
});

export const RawFindingSchema = FindingBodySchema.extend({
  id: z.string().min(1).optional(),
});

export const FindingSchema = FindingBodySchema.extend({
  id: z.string().min(1),
});

export type Finding = z.infer<typeof FindingSchema>;
export type RawFinding = z.infer<typeof RawFindingSchema>;

export const AgentConfigSchema = z.object({
  name: z.string().min(1),
  mandate: z.string().min(1),
  model: z.string().min(1).optional(),
  include_patterns: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    name: "security",
    mandate:
      "Review for security vulnerabilities. Look for injection risks, exposed secrets, broken auth, insecure defaults, and unsafe data handling.",
  },
  {
    name: "performance",
    mandate:
      "Review for performance issues. Look for N+1 queries, unnecessary re-renders, expensive operations in hot paths, and missing pagination.",
  },
  {
    name: "architecture",
    mandate:
      "Review for architectural concerns. Look for separation of concerns violations, tight coupling, naming inconsistency, and patterns that do not fit the codebase.",
  },
  {
    name: "dx",
    mandate:
      "Review for developer experience. Look for missing tests, outdated docs, unclear variable names, and changes that will be hard to maintain.",
  },
];

export const DEFAULT_DEBATE_CONFIG = {
  rounds: 2,
  min_confidence: 0.6,
};

export const DEFAULT_PRINCIPAL_MANDATE =
  "You are the principal engineer. Read the full debate and make final calls. Be direct. Show your reasoning. Surface genuine disagreements clearly.";

export const DebateConfigSchema = z.object({
  rounds: z.number().int().min(0).default(DEFAULT_DEBATE_CONFIG.rounds),
  min_confidence: z
    .number()
    .min(0)
    .max(1)
    .default(DEFAULT_DEBATE_CONFIG.min_confidence),
});

export const PrincipalConfigSchema = z.object({
  mandate: z.string().min(1).default(DEFAULT_PRINCIPAL_MANDATE),
});

export const DiffConfigSchema = z.object({
  max_files: z.number().int().positive().default(80),
  max_patch_chars_per_file: z.number().int().positive().default(12_000),
  max_total_chars: z.number().int().positive().default(180_000),
  exclude_patterns: z.array(z.string()).default([]),
  include_patterns: z.array(z.string()).default([]),
});

export type DiffConfig = z.infer<typeof DiffConfigSchema>;

export const ProviderTypeSchema = z.enum([
  "anthropic",
  "openai",
  "openrouter",
  "openclaw",
  "hermes",
  "groq",
  "together",
  "mistral",
  "cohere",
  "perplexity",
  "hyperbolic",
  "gemini",
  "custom",
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const AnthropicConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("claude-3-5-sonnet-latest"),
});

export const OpenAIConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("gpt-4o"),
  baseURL: z.string().url().optional(),
});

export const OpenRouterConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("anthropic/claude-3.5-sonnet"),
});

export const OpenClawConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("kimi-k2.5:cloud"),
  baseURL: z.string().url().default("http://localhost:11434/v1"),
});

export const HermesConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("nous-hermes-3-llama-3.1-405b"),
  baseURL: z.string().url().default("http://localhost:8080/v1"),
});

export const GroqConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("llama-3.3-70b-versatile"),
});

export const TogetherConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("meta-llama/Llama-3.3-70B-Instruct-Turbo"),
});

export const MistralConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("mistral-large-latest"),
});

export const CohereConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("command-r-plus"),
});

export const PerplexityConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("llama-3.1-sonar-small-128k-online"),
});

export const HyperbolicConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("meta-llama/Llama-3.3-70B-Instruct"),
});

export const GeminiConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1).default("gemini-2.0-flash-exp"),
});

export const CustomProviderConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().min(1),
  baseURL: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export const ProviderConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("anthropic"), config: AnthropicConfigSchema }),
  z.object({ type: z.literal("openai"), config: OpenAIConfigSchema }),
  z.object({ type: z.literal("openrouter"), config: OpenRouterConfigSchema }),
  z.object({ type: z.literal("openclaw"), config: OpenClawConfigSchema }),
  z.object({ type: z.literal("hermes"), config: HermesConfigSchema }),
  z.object({ type: z.literal("groq"), config: GroqConfigSchema }),
  z.object({ type: z.literal("together"), config: TogetherConfigSchema }),
  z.object({ type: z.literal("mistral"), config: MistralConfigSchema }),
  z.object({ type: z.literal("cohere"), config: CohereConfigSchema }),
  z.object({ type: z.literal("perplexity"), config: PerplexityConfigSchema }),
  z.object({ type: z.literal("hyperbolic"), config: HyperbolicConfigSchema }),
  z.object({ type: z.literal("gemini"), config: GeminiConfigSchema }),
  z.object({ type: z.literal("custom"), config: CustomProviderConfigSchema }),
]);

export const StaticAnalysisCommandSchema = z.discriminatedUnion("parser", [
  z.object({
    parser: z.literal("eslint-json"),
    name: z.string().min(1),
    run: z.string().min(1),
    outputFile: z.string().min(1).optional(),
  }),
  z.object({
    parser: z.literal("regex"),
    name: z.string().min(1),
    run: z.string().min(1),
    regex: z.string().min(1),
    outputFile: z.string().min(1).optional(),
  }),
]);

export const StaticAnalysisConfigSchema = z.object({
  enabled: z.boolean().default(false),
  commands: z.array(StaticAnalysisCommandSchema).default([]),
});

export const ContextEnrichmentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  max_depth: z.number().int().min(1).default(1),
  file_size_limit_kb: z.number().int().min(1).default(100),
});

export const SwarmConfigSchema = z.object({
  agents: z.array(AgentConfigSchema).min(1).default(DEFAULT_AGENTS),
  debate: DebateConfigSchema.default(DEFAULT_DEBATE_CONFIG),
  principal: PrincipalConfigSchema.default({ mandate: DEFAULT_PRINCIPAL_MANDATE }),
  output: z
    .object({
      mode: z.enum(["outcome", "full"]).default("outcome"),
      inline: z.boolean().default(false),
      review_event: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES", "AUTO"]).default("COMMENT"),
    })
    .default({ mode: "outcome", inline: false, review_event: "COMMENT" }),
  diff: DiffConfigSchema.default({
    max_files: 80,
    max_patch_chars_per_file: 12_000,
    max_total_chars: 180_000,
    exclude_patterns: [],
    include_patterns: [],
  }),
  provider: ProviderConfigSchema.optional(),
  static_analysis: StaticAnalysisConfigSchema.default({
    enabled: false,
    commands: [],
  }),
  context_enrichment: ContextEnrichmentConfigSchema.default({
    enabled: true,
    max_depth: 1,
    file_size_limit_kb: 100,
  }),
});

export type DebateConfig = z.infer<typeof DebateConfigSchema>;
export type PrincipalConfig = z.infer<typeof PrincipalConfigSchema>;
export type SwarmConfig = z.infer<typeof SwarmConfigSchema>;
export type StaticAnalysisCommand = z.infer<typeof StaticAnalysisCommandSchema>;
export type StaticAnalysisConfig = z.infer<typeof StaticAnalysisConfigSchema>;
export type ContextEnrichmentConfig = z.infer<typeof ContextEnrichmentConfigSchema>;


export const FileDiffSchema = z.object({
  path: z.string().min(1),
  status: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative(),
  patch: z.string().optional(),
  previousPath: z.string().min(1).optional(),
});

export type FileDiff = z.infer<typeof FileDiffSchema>;

export const DebateTranscriptSchema = z.object({
  rounds: z.array(z.array(FindingSchema)),
  agents: z.array(AgentConfigSchema),
});

export type DebateTranscript = z.infer<typeof DebateTranscriptSchema>;

export const PrincipalDecisionSchema = z.object({
  finding: FindingSchema,
  decision: z.string().min(1),
  status: z.enum(["accepted", "rejected", "deferred"]).optional(),
});

export const PrincipalDisputeSchema = z.object({
  finding: FindingSchema,
  rebuttal: FindingSchema,
});

export const PrincipalSummarySchema = z.object({
  agreements: z.array(FindingSchema),
  disputes: z.array(PrincipalDisputeSchema),
  final_calls: z.array(PrincipalDecisionSchema),
  summary: z.string().min(1),
});

export type PrincipalSummary = z.infer<typeof PrincipalSummarySchema>;

export type AnthropicConfig = z.infer<typeof AnthropicConfigSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type OpenRouterConfig = z.infer<typeof OpenRouterConfigSchema>;
export type OpenClawConfig = z.infer<typeof OpenClawConfigSchema>;
export type HermesConfig = z.infer<typeof HermesConfigSchema>;
export type GroqConfig = z.infer<typeof GroqConfigSchema>;
export type TogetherConfig = z.infer<typeof TogetherConfigSchema>;
export type MistralConfig = z.infer<typeof MistralConfigSchema>;
export type CohereConfig = z.infer<typeof CohereConfigSchema>;
export type PerplexityConfig = z.infer<typeof PerplexityConfigSchema>;
export type HyperbolicConfig = z.infer<typeof HyperbolicConfigSchema>;
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;
export type CustomProviderConfig = z.infer<typeof CustomProviderConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  type: "anthropic",
  config: { apiKey: "", model: "claude-3-5-sonnet-latest" },
};