import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateTypeScript } from "./tsgen.ts";

test("generates interfaces with named nested types", () => {
  const root = inferType({
    name: "Jane",
    age: 30,
    nick: null,
    tags: ["a"],
    address: { street: "1 Main St" },
    "my-key": true,
  });
  const out = generateTypeScript(root, "User");
  assert.ok(out.includes("export interface User {"));
  assert.ok(out.includes("  age: number;"));
  assert.ok(out.includes("  nick: (unknown | null);"));
  assert.ok(out.includes("  tags: string[];"));
  assert.ok(out.includes("  address: Address;"));
  assert.ok(out.includes('  "my-key": boolean;'));
  assert.ok(out.includes("export interface Address {"));
  assert.ok(out.includes("  street: string;"));
});

test("marks fields absent in some objects as optional", () => {
  const root = inferType([{ a: 1 }, { a: 2, b: "x" }]);
  const out = generateTypeScript(root, "Row");
  assert.ok(out.includes("  a: number;"));
  assert.ok(out.includes("  b?: string;"));
});

test("nullable array elements", () => {
  const root = inferType({ xs: [1, null] });
  const out = generateTypeScript(root, "Root");
  assert.ok(out.includes("  xs: (number | null)[];"));
});

test("scalar top-level input emits a type alias", () => {
  const out = generateTypeScript(inferType(42), "Root");
  assert.equal(out, "export type Root = number;\n");
});
