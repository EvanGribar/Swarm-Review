import { z } from "zod";

export const SCHEMA_VERSION = "1.0" as const;
const Identifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/, "must be a stable identifier");
const SafePath = z.string().min(1).max(4096).refine((path) => !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes(".."), "must be a repository-relative path");
const Metadata = z.record(z.unknown()).refine((value) => !Object.prototype.hasOwnProperty.call(value, "__proto__") && !Object.prototype.hasOwnProperty.call(value, "constructor"), "contains unsafe keys");

export const SeveritySchema = z.enum(["blocking", "warning", "informational"]);
export const CoverageStatusSchema = z.enum(["satisfied", "violated", "not_verifiable", "not_applicable"]);
export const SourceLocationSchema = z.object({
  type: z.string().min(1),
  path: SafePath.optional(),
  uri: z.string().url().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional()
}).superRefine((value, ctx) => {
  if (value.endLine && value.startLine && value.endLine < value.startLine) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endLine must not precede startLine" });
  }
  if (!value.path && !value.uri) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "path or uri is required" });
  }
});
export const EvidenceLocationSchema = z.object({
  path: SafePath,
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  symbol: z.string().min(1).optional(),
  explanation: z.string().min(1).optional(),
  uri: z.string().url().optional()
}).superRefine((value, ctx) => {
  if (value.endLine && value.endLine < value.startLine) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endLine must not precede startLine" });
  }
});
export const AcceptanceCriterionSchema = z.object({
  id: Identifier,
  description: z.string().min(1),
  metadata: Metadata.optional()
});
export const RequirementSchema = z.object({
  id: Identifier,
  title: z.string().min(1),
  description: z.string().min(1),
  severity: SeveritySchema.optional(),
  criteria: z.array(AcceptanceCriterionSchema).min(1),
  source: SourceLocationSchema,
  metadata: Metadata.optional()
}).superRefine((value, ctx) => {
  const ids = new Set<string>();
  value.criteria.forEach((criterion, index) => {
    if (ids.has(criterion.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["criteria", index, "id"], message: "duplicate criterion id" });
    }
    ids.add(criterion.id);
  });
});
export const SpecificationSourceSchema = z.object({
  type: z.string().min(1),
  path: SafePath.optional(),
  uri: z.string().url().optional(),
  label: z.string().min(1).optional()
});
export const RequirementContractSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Identifier,
  title: z.string().min(1),
  source: SpecificationSourceSchema,
  requirements: z.array(RequirementSchema).min(1),
  metadata: Metadata.optional()
}).superRefine((value, ctx) => {
  const ids = new Set<string>();
  value.requirements.forEach((requirement, index) => {
    if (ids.has(requirement.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["requirements", index, "id"], message: "duplicate requirement id" });
    }
    ids.add(requirement.id);
  });
});
export const ReviewTargetSchema = z.object({
  repository: z.string().min(1).optional(),
  commitSha: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
  baseUri: z.string().url().optional()
});
export const ReviewerIdentitySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1).optional()
});
export const ExecutionMetadataSchema = z.object({
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  runId: z.string().min(1).optional(),
  metadata: Metadata.optional()
});
export const CriterionCoverageSchema = z.object({
  criterionId: Identifier,
  status: CoverageStatusSchema,
  explanation: z.string().min(1),
  evidence: z.array(EvidenceLocationSchema),
  confidence: z.number().min(0).max(1).optional()
}).superRefine((value, ctx) => {
  if (value.status === "violated" && value.evidence.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"], message: "violated criteria require evidence" });
  }
});
export const RequirementCoverageSchema = z.object({
  requirementId: Identifier,
  severity: SeveritySchema.optional(),
  criteria: z.array(CriterionCoverageSchema).min(1)
});
export const ReviewCoverageReportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  contractId: Identifier,
  reviewer: ReviewerIdentitySchema,
  target: ReviewTargetSchema,
  execution: ExecutionMetadataSchema.optional(),
  requirements: z.array(RequirementCoverageSchema).min(1),
  metadata: Metadata.optional()
});

export type RequirementContract = z.infer<typeof RequirementContractSchema>;
export type ReviewCoverageReport = z.infer<typeof ReviewCoverageReportSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type CriterionCoverage = z.infer<typeof CriterionCoverageSchema>;
export type EvidenceLocation = z.infer<typeof EvidenceLocationSchema>;
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

export class SpecBridgeValidationError extends Error {
  constructor(message: string, public readonly issues: z.ZodIssue[]) {
    super(message);
    this.name = "SpecBridgeValidationError";
  }
}

export function parseContract(input: unknown): RequirementContract {
  const parsed = RequirementContractSchema.safeParse(input);
  if (!parsed.success) throw new SpecBridgeValidationError("Invalid requirement contract", parsed.error.issues);
  return parsed.data;
}

export function parseCoverageReport(input: unknown): ReviewCoverageReport {
  const parsed = ReviewCoverageReportSchema.safeParse(input);
  if (!parsed.success) throw new SpecBridgeValidationError("Invalid coverage report", parsed.error.issues);
  return parsed.data;
}

export function validateCoverageAgainstContract(contractInput: RequirementContract, reportInput: ReviewCoverageReport): ReviewCoverageReport {
  const contract = parseContract(contractInput);
  const report = parseCoverageReport(reportInput);
  if (report.contractId !== contract.id) throw new SpecBridgeValidationError("Coverage report targets a different contract", []);
  const expected = new Map(contract.requirements.map((requirement) => [requirement.id, new Set(requirement.criteria.map((criterion) => criterion.id))]));
  const seenRequirements = new Set<string>();
  const issues: z.ZodIssue[] = [];
  for (const requirement of report.requirements) {
    if (seenRequirements.has(requirement.requirementId)) {
      issues.push({ code: z.ZodIssueCode.custom, path: ["requirements"], message: `duplicate requirement coverage: ${requirement.requirementId}` });
    }
    seenRequirements.add(requirement.requirementId);
    const expectedCriteria = expected.get(requirement.requirementId);
    if (!expectedCriteria) {
      issues.push({ code: z.ZodIssueCode.custom, path: ["requirements"], message: `unknown requirement coverage: ${requirement.requirementId}` });
      continue;
    }
    const seenCriteria = new Set<string>();
    for (const criterion of requirement.criteria) {
      if (seenCriteria.has(criterion.criterionId)) {
        issues.push({ code: z.ZodIssueCode.custom, path: ["requirements"], message: `duplicate criterion coverage: ${criterion.criterionId}` });
      }
      seenCriteria.add(criterion.criterionId);
      if (!expectedCriteria.has(criterion.criterionId)) {
        issues.push({ code: z.ZodIssueCode.custom, path: ["requirements"], message: `unknown criterion coverage: ${criterion.criterionId}` });
      }
    }
    for (const criterionId of expectedCriteria) {
      if (!seenCriteria.has(criterionId)) {
        issues.push({ code: z.ZodIssueCode.custom, path: ["requirements"], message: `missing criterion coverage: ${criterionId}` });
      }
    }
  }
  for (const requirement of contract.requirements) {
    if (!seenRequirements.has(requirement.id)) {
      issues.push({ code: z.ZodIssueCode.custom, path: ["requirements"], message: `missing requirement coverage: ${requirement.id}` });
    }
  }
  if (issues.length) throw new SpecBridgeValidationError("Coverage report does not conform to its contract", issues);
  return report;
}
