import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateGo } from "./gogen.ts";

test("generates structs with json tags", () => {
  const root = inferType([
    { userName: "Jane", age: null, tags: ["a"], nested: { ok: true } },
    { userName: "Bob", age: 30, tags: [], nested: { ok: false } },
  ]);
  const out = generateGo(root, "User");
  assert.ok(out.includes("type User struct {"));
  assert.ok(out.includes('UserName string `json:"userName"`'));
  assert.ok(out.includes('*float64 `json:"age"`'));
  assert.ok(out.includes('[]string `json:"tags"`'));
  assert.ok(out.includes('Nested `json:"nested"`'));
  assert.ok(out.includes("type Nested struct {"));
  assert.ok(out.includes('Ok bool `json:"ok"`'));
});

test("scalar top-level input emits a type alias", () => {
  const out = generateGo(inferType("hi"), "Root");
  assert.equal(out, "type Root string\n");
});
