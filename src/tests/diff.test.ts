import assert from "node:assert/strict";
import test from "node:test";

import { formatFileDiffs, globToRegex } from "../diff.js";
import type { FileDiff } from "../types.js";

test("formatFileDiffs renders multiple files and large patches", () => {
  const files: FileDiff[] = [
    {
      path: "src/large.ts",
      status: "modified",
      additions: 10,
      deletions: 1,
      changes: 11,
      patch: "x".repeat(80),
    },
    {
      path: "src/extra.ts",
      status: "added",
      additions: 5,
      deletions: 0,
      changes: 5,
      patch: "+const a = 1;",
    },
  ];

  const rendered = formatFileDiffs(files);

  assert.match(rendered, /### src\/large\.ts/);
  assert.match(rendered, /### src\/extra\.ts/);
  assert.match(rendered, /```diff\nx{80}\n```/);
  assert.match(rendered, /```diff\n\+const a = 1;\n```/);
});

test("globToRegex converts glob patterns correctly", () => {
  const r1 = globToRegex("*.spec.ts");
  assert.ok(r1.test("foo.spec.ts"));
  assert.ok(r1.test("src/foo.spec.ts"));
  assert.ok(!r1.test("foo.spec.ts.bak"));

  const r2 = globToRegex("dist/**");
  assert.ok(r2.test("dist/index.js"));
  assert.ok(r2.test("dist/sub/index.js"));
  assert.ok(!r2.test("src/dist/index.js"));

  const r3 = globToRegex("**/node_modules/**");
  assert.ok(r3.test("node_modules/foo/index.js"));
  assert.ok(r3.test("src/node_modules/foo/index.js"));
  assert.ok(!r3.test("src/node_modules_fake/index.js"));
});

test("formatFileDiffs respects glob patterns in exclude_patterns", () => {
  const files: FileDiff[] = [
    {
      path: "src/foo.spec.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "test",
    },
    {
      path: "dist/index.js",
      status: "added",
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: "build",
    },
    {
      path: "src/index.ts",
      status: "modified",
      additions: 2,
      deletions: 2,
      changes: 4,
      patch: "code",
    },
  ];

  const rendered = formatFileDiffs(files, {
    exclude_patterns: ["*.spec.ts", "dist/**"],
  });

  assert.ok(!rendered.includes("src/foo.spec.ts"));
  assert.ok(!rendered.includes("dist/index.js"));
  assert.ok(rendered.includes("src/index.ts"));
});

