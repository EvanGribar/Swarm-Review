import assert from "node:assert/strict";
import test from "node:test";

import { clearRegisteredSecrets, redactSecrets, registerSecret } from "../redact.js";

test("redactSecrets masks registered secret values exactly", (t) => {
  t.after(clearRegisteredSecrets);
  registerSecret("super-secret-provider-key-123");

  assert.equal(
    redactSecrets("call failed with key super-secret-provider-key-123 in body"),
    "call failed with key [REDACTED] in body"
  );
});

test("redactSecrets ignores short or missing registrations", (t) => {
  t.after(clearRegisteredSecrets);
  registerSecret("short");
  registerSecret(undefined);

  assert.equal(redactSecrets("nothing to hide here"), "nothing to hide here");
});

test("redactSecrets masks common token shapes without registration", (t) => {
  t.after(clearRegisteredSecrets);

  assert.equal(redactSecrets("key sk-ant-api03-abcdefghij123456"), "key [REDACTED]");
  assert.equal(redactSecrets("auth Bearer abcdefghij123456"), "auth [REDACTED]");
  assert.equal(redactSecrets("token gho_abcdefghij123456"), "token [REDACTED]");
});

test("redactSecrets leaves ordinary messages intact", () => {
  assert.equal(
    redactSecrets("Anthropic request failed with 429: too busy"),
    "Anthropic request failed with 429: too busy"
  );
});
