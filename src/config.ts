import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

import {
  DEFAULT_AGENTS,
  DEFAULT_DEBATE_CONFIG,
  DEFAULT_PRINCIPAL_MANDATE,
  SwarmConfigSchema,
  type SwarmConfig,
} from "./types.js";

export const DEFAULT_SWARM_CONFIG: SwarmConfig = SwarmConfigSchema.parse({
  agents: DEFAULT_AGENTS,
  debate: DEFAULT_DEBATE_CONFIG,
  principal: { mandate: DEFAULT_PRINCIPAL_MANDATE },
  output: { mode: "outcome" },
});

const ENV_VAR_REFERENCE_PATTERN = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;

function resolveEnvReference(value: string, pathLabel: string): string {
  const match = ENV_VAR_REFERENCE_PATTERN.exec(value);
  if (!match) {
    return value;
  }

  const [, envName] = match;
  const resolved = process.env[envName];
  if (resolved === undefined) {
    throw new Error(
      `Missing environment variable "${envName}" referenced by config value at "${pathLabel}".`
    );
  }

  return resolved;
}

function resolveConfigEnvReferences(value: unknown, pathLabel = "$"): unknown {
  if (typeof value === "string") {
    return resolveEnvReference(value, pathLabel);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => resolveConfigEnvReferences(item, `${pathLabel}[${index}]`));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    return Object.fromEntries(
      entries.map(([key, item]) => [key, resolveConfigEnvReferences(item, `${pathLabel}.${key}`)])
    );
  }

  return value;
}

export async function loadSwarmConfig(
  workspaceRoot: string = process.cwd(),
  configPath = ".swarm.yml"
): Promise<SwarmConfig> {
  const resolvedConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(workspaceRoot, configPath);

  if (!existsSync(resolvedConfigPath)) {
    console.log(`::warning::Config file not found at ${resolvedConfigPath}, using default configuration.`);
    return DEFAULT_SWARM_CONFIG;
  }

  const rawConfig = await readFile(resolvedConfigPath, "utf8");
  const parsedConfig = yaml.load(rawConfig) ?? {};
  const resolvedConfig = resolveConfigEnvReferences(parsedConfig);
  return SwarmConfigSchema.parse(resolvedConfig);
}
