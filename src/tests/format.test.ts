import assert from "node:assert/strict";
import test from "node:test";

import { renderDebateTranscriptMarkdown, sanitizeModelMarkdown } from "../format.js";
import type { DebateTranscript } from "../types.js";

test("renderDebateTranscriptMarkdown formats rounds and findings", () => {
  const transcript: DebateTranscript = {
    agents: [{ name: "security", mandate: "Review security." }],
    rounds: [
      [
        {
          id: "r1",
          agent: "security",
          severity: "blocking",
          file: "src/app.ts",
          line: 12,
          claim: "Unsafe string concatenation in query building.",
          confidence: 0.92,
        },
      ],
      [],
    ],
  };

  const markdown = renderDebateTranscriptMarkdown(transcript);

  assert.match(markdown, /### Debate Transcript/);
  assert.match(markdown, /#### Round 1/);
  assert.match(markdown, /\[BLOCKING\].*src\/app\.ts:12/);
  assert.match(markdown, /#### Round 2/);
  assert.match(markdown, /No findings in this round\./);
});

test("sanitizeModelMarkdown strips images and masks secrets", (t) => {
  t.after(() => import("../redact.js").then((m) => m.clearRegisteredSecrets()));

  assert.equal(
    sanitizeModelMarkdown("See ![proof](https://attacker.example/x?d=1) done"),
    "See [image removed] done"
  );
  assert.equal(
    sanitizeModelMarkdown("key sk-ant-api03-abcdefghij123456 leaked"),
    "key [REDACTED] leaked"
  );
  assert.equal(
    sanitizeModelMarkdown("## swarm-review\n\nAll clear."),
    "## swarm-review\n\nAll clear."
  );
});