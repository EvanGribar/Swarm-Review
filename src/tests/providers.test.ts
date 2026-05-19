import assert from "node:assert/strict";
import test from "node:test";

import { resolveProviderConfig } from "../config.js";
import { SwarmConfigSchema, type SwarmConfig } from "../types.js";

function mockSwarmConfig(overrides: Record<string, any> = {}): SwarmConfig {
  return SwarmConfigSchema.parse(overrides);
}

test("resolveProviderConfig falls back to legacy Anthropic config if provider is not defined", () => {
  const swarmConfig = mockSwarmConfig();

  const config = resolveProviderConfig(swarmConfig, "anthropic-key-123", "claude-3-5-sonnet-latest");

  assert.equal(config.type, "anthropic");
  assert.equal(config.config.apiKey, "anthropic-key-123");
  assert.equal(config.config.model, "claude-3-5-sonnet-latest");
});

test("resolveProviderConfig throws if legacy Anthropic key is missing and no provider config exists", () => {
  const swarmConfig = mockSwarmConfig();

  assert.throws(() => {
    resolveProviderConfig(swarmConfig, undefined, "claude-3-5-sonnet-latest");
  }, /Anthropic API key is required/);
});

test("resolveProviderConfig respects configured apiKey in swarmConfig", () => {
  const swarmConfig = mockSwarmConfig({
    provider: {
      type: "openai",
      config: {
        apiKey: "config-openai-key",
        model: "gpt-4o",
      },
    },
  });

  const config = resolveProviderConfig(swarmConfig, undefined, "claude-3-5-sonnet-latest");

  assert.equal(config.type, "openai");
  assert.equal(config.config.apiKey, "config-openai-key");
});

test("resolveProviderConfig resolves missing apiKey from environment variables / inputs", () => {
  const swarmConfig = mockSwarmConfig({
    provider: {
      type: "openai",
      config: {
        apiKey: "",
        model: "gpt-4o",
      },
    },
  });

  // Set environment variable
  process.env.INPUT_OPENAI_API_KEY = "env-openai-key";

  try {
    const config = resolveProviderConfig(swarmConfig, undefined, "claude-3-5-sonnet-latest");
    assert.equal(config.type, "openai");
    assert.equal(config.config.apiKey, "env-openai-key");
  } finally {
    delete process.env.INPUT_OPENAI_API_KEY;
  }
});

test("resolveProviderConfig throws if provider apiKey is missing and not found in environment", () => {
  const swarmConfig = mockSwarmConfig({
    provider: {
      type: "openai",
      config: {
        apiKey: "",
        model: "gpt-4o",
      },
    },
  });

  assert.throws(() => {
    resolveProviderConfig(swarmConfig, undefined, "claude-3-5-sonnet-latest");
  }, /Provider API key is required for openai/);
});
