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
  type ProviderConfig,
} from "./types.js";

export function readInput(name: string): string | undefined {
  const candidates = [
    `INPUT_${name.toUpperCase()}`,
    `INPUT_${name.replace(/-/g, "_").toUpperCase()}`,
    name.toUpperCase(),
    name.replace(/-/g, "_").toUpperCase(),
  ];
  for (const c of candidates) {
    if (process.env[c]) {
      return process.env[c];
    }
  }
  return undefined;
}

export function resolveProviderConfig(
  swarmConfig: SwarmConfig,
  legacyAnthropicApiKey: string | undefined,
  legacyAnthropicModel: string
): ProviderConfig {
  if (!swarmConfig.provider) {
    if (!legacyAnthropicApiKey) {
      throw new Error("Anthropic API key is required (set ANTHROPIC_API_KEY or anthropic-api-key input).");
    }
    return {
      type: "anthropic",
      config: { apiKey: legacyAnthropicApiKey, model: legacyAnthropicModel },
    };
  }

  const { type, config } = swarmConfig.provider;
  if (config.apiKey && config.apiKey.length > 0) {
    return swarmConfig.provider;
  }

  const resolvedApiKey = readInput(`${type}-api-key`) || (type === "anthropic" ? legacyAnthropicApiKey : undefined);
  if (!resolvedApiKey) {
    throw new Error(`Provider API key is required for ${type}. Please set ${type.toUpperCase()}_API_KEY environment variable.`);
  }

  return {
    type,
    config: {
      ...config,
      apiKey: resolvedApiKey,
    },
  } as ProviderConfig;
}

export const DEFAULT_SWARM_CONFIG: SwarmConfig = SwarmConfigSchema.parse({
  agents: DEFAULT_AGENTS,
  debate: DEFAULT_DEBATE_CONFIG,
  principal: { mandate: DEFAULT_PRINCIPAL_MANDATE },
  output: { mode: "outcome" },
});

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
  return SwarmConfigSchema.parse(parsedConfig);
}