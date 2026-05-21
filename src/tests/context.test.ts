import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import ts from "typescript";

import {
  resolveImportPath,
  getImportSpecifiers,
  extractSignatures,
  buildCodebaseIndex,
  gatherContextForDiff,
} from "../context.js";

test("getImportSpecifiers extracts all kinds of imports/requires", () => {
  const code = `
    import { a } from "./foo";
    import b from "../bar.js";
    export { c } from "./baz";
    const d = require("./qux");
    const e = import("./dynamic");
    // Ignore external
    import { Axios } from "axios";
  `;
  const sf = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
  const specifiers = getImportSpecifiers(sf);

  assert.deepEqual(specifiers, [
    "./foo",
    "../bar.js",
    "./baz",
    "./qux",
    "./dynamic",
    "axios",
  ]);
});

test("resolveImportPath correctly resolves extensions and directories", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "swarm-context-test-"));
  
  await writeFile(path.join(tempDir, "foo.ts"), "export const foo = 1;");
  await writeFile(path.join(tempDir, "bar.tsx"), "export const bar = 2;");
  
  const subDir = path.join(tempDir, "utils");
  const fs = await import("node:fs");
  fs.mkdirSync(subDir);
  await writeFile(path.join(subDir, "index.ts"), "export const index = 3;");

  const importingFile = path.join(tempDir, "main.ts");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Resolve direct file
  const r1 = resolveImportPath(importingFile, "./foo");
  assert.equal(r1, path.resolve(tempDir, "foo.ts"));

  const r2 = resolveImportPath(importingFile, "./bar");
  assert.equal(r2, path.resolve(tempDir, "bar.tsx"));

  // Resolve directory index
  const r3 = resolveImportPath(importingFile, "./utils");
  assert.equal(r3, path.resolve(subDir, "index.ts"));

  // Check invalid/external
  const r4 = resolveImportPath(importingFile, "external-library");
  assert.equal(r4, null);
});

test("extractSignatures filters bodies and returns correct declarations", () => {
  const fileContent = `
    export function greet(name: string): string {
      return "Hello " + name;
    }
    
    export class Calculator {
      private secret = 42;
      constructor(public base: number) {}
      
      add(val: number): number {
        return this.base + val;
      }
    }

    export interface User {
      id: string;
      name: string;
    }

    export type Callback = (err: Error | null) => void;

    export const multiplier = (a: number): number => {
      return a * 2;
    };

    let count = 0;
  `;

  const sigs = extractSignatures("calc.ts", fileContent);

  // Check expected signatures
  assert.match(sigs, /export function greet\(name: string\): string/);
  assert.match(sigs, /export class Calculator/);
  assert.match(sigs, /constructor\(public base: number\)/);
  assert.match(sigs, /add\(val: number\): number/);
  assert.match(sigs, /export interface User/);
  assert.match(sigs, /export type Callback = \(err: Error \| null\) => void;/);
  assert.match(sigs, /export const multiplier = \(a: number\): number/);

  // Verify private fields are skipped
  assert.equal(sigs.includes("private secret"), false);
  // Verify bodies are removed
  assert.equal(sigs.includes("return this.base + val"), false);
});

test("gatherContextForDiff builds context for changed files using index and imports", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "swarm-context-test-"));
  
  const depCode = `
    export function helper(): void {
      console.log("helper");
    }
  `;
  const mainCode = `
    import { helper } from "./dep";
    export function main(): void {
      helper();
    }
  `;

  await writeFile(path.join(tempDir, "dep.ts"), depCode);
  await writeFile(path.join(tempDir, "main.ts"), mainCode);

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const diff = [
    {
      path: "main.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "@@ -1,3 +1,3 @@\n-import { helper } from './dep';\n+import { helper } from './dep';\n helper();",
    },
  ];

  const config = {
    enabled: true,
    max_depth: 1,
    file_size_limit_kb: 100,
  };

  const codebaseIndex = buildCodebaseIndex(tempDir, config);
  const context = await gatherContextForDiff(diff, tempDir, config, codebaseIndex);

  assert.match(context, /### Supporting Code Context/);
  assert.match(context, /File: `dep\.ts`/);
  assert.match(context, /export function helper\(\): void/);
});
