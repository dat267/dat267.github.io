import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateCode } from "./generate.ts";

const SAMPLE = JSON.stringify({
  id: 1,
  name: "Jane",
  tags: ["a", "b"],
  meta: { ok: true },
});

test("typescript target", () => {
  assert.ok(
    generateCode(SAMPLE, "typescript", "User").includes(
      "export interface User {",
    ),
  );
});

test("go target", () => {
  assert.ok(generateCode(SAMPLE, "go", "User").includes("type User struct {"));
});

test("python target", () => {
  assert.ok(generateCode(SAMPLE, "python", "User").includes("class User:"));
});

test("rust target", () => {
  assert.ok(generateCode(SAMPLE, "rust", "User").includes("pub struct User {"));
});

test("json-schema target", () => {
  assert.ok(
    generateCode(SAMPLE, "json-schema", "User").includes("#/definitions/User"),
  );
});

test("invalid JSON throws", () => {
  assert.throws(() => generateCode("{nope", "typescript", "User"));
});
