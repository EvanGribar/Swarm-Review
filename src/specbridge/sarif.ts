import { createHash } from "node:crypto";
import type { ReviewCoverageReport } from "./core.js";

export type SarifLog = { $schema: string; version: "2.1.0"; runs: Array<Record<string, unknown>> };
const level = (severity?: string) => (severity === "blocking" ? "error" : severity === "warning" ? "warning" : "note");
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");

/** Converts only evidenced violated criteria to GitHub Code Scanning compatible SARIF 2.1.0. */
export function toSarif(report: ReviewCoverageReport, options: { toolName?: string } = {}): SarifLog {
  const rules: Array<Record<string, unknown>> = [];
  const results: Array<Record<string, unknown>> = [];
  for (const requirement of report.requirements) {
    for (const criterion of requirement.criteria) {
      if (criterion.status === "violated") {
        const ruleId = `specbridge/${requirement.requirementId}/${criterion.criterionId}`;
        const sarifLevel = level(requirement.severity);
        rules.push({
          id: ruleId,
          name: criterion.criterionId,
          shortDescription: { text: `Requirement ${requirement.requirementId}` },
          defaultConfiguration: { level: sarifLevel }
        });
        const locations = criterion.evidence.map((evidence) => ({
          physicalLocation: {
            artifactLocation: { uri: evidence.uri ?? evidence.path, uriBaseId: "SRCROOT" },
            region: { startLine: evidence.startLine, ...(evidence.endLine ? { endLine: evidence.endLine } : {}) }
          }
        }));
        results.push({
          ruleId,
          level: sarifLevel,
          message: { text: criterion.explanation },
          locations,
          partialFingerprints: {
            "specbridge/v1": fingerprint(`${ruleId}:${criterion.evidence.map((item) => `${item.path}:${item.startLine}`).join(",")}`)
          },
          properties: {
            requirementId: requirement.requirementId,
            criterionId: criterion.criterionId,
            reviewer: report.reviewer.name,
            confidence: criterion.confidence
          }
        });
      }
    }
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{ tool: { driver: { name: options.toolName ?? "SpecBridge", rules } }, originalUriBaseIds: { SRCROOT: { uri: report.target.baseUri ?? "file:///" } }, results }]
  };
}
