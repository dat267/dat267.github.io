import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType, mergeFields } from "./ast.ts";

test("infers scalar fields", () => {
  const f = inferType({ name: "Jane", age: 30, active: true });
  assert.equal(f.type.kind, "object");
  if (f.type.kind !== "object") return;
  assert.equal(f.type.fields.get("name")?.type.kind, "string");
  assert.equal(f.type.fields.get("age")?.type.kind, "number");
  assert.equal(f.type.fields.get("active")?.type.kind, "boolean");
});

test("marks null values as nullable", () => {
  const f = inferType({ a: null, b: "x" });
  if (f.type.kind !== "object") throw new Error("expected object");
  assert.equal(f.type.fields.get("a")?.nullable, true);
  assert.equal(f.type.fields.get("a")?.type.kind, "any");
  assert.equal(f.type.fields.get("b")?.nullable, false);
});

test("merges array element objects", () => {
  const f = inferType([
    { id: 1, name: "a" },
    { id: 2, name: "b", extra: true },
  ]);
  if (f.type.kind !== "array") throw new Error("expected array");
  const item = f.type.items;
  assert.equal(item.nullable, false);
  if (item.type.kind !== "object") throw new Error("expected object");
  assert.equal(item.type.fields.size, 3);
  assert.equal(item.type.fields.get("id")?.type.kind, "number");
  assert.equal(item.type.fields.get("extra")?.nullable, false);
  assert.equal(item.type.fields.get("extra")?.required, false);
});

test("heterogeneous array items collapse to any", () => {
  const f = inferType([1, "x"]);
  if (f.type.kind !== "array") throw new Error("expected array");
  assert.equal(f.type.items.type.kind, "any");
});

test("nested object fields infer recursively", () => {
  const f = inferType({ meta: { tags: ["a", "b"] } });
  if (f.type.kind !== "object") throw new Error("expected object");
  const meta = f.type.fields.get("meta");
  if (!meta || meta.type.kind !== "object")
    throw new Error("expected nested object");
  const tags = meta.type.fields.get("tags");
  if (!tags || tags.type.kind !== "array") throw new Error("expected array");
  assert.equal(tags.type.items.type.kind, "string");
});

test("mergeFields unions nullability", () => {
  const a = inferType("x");
  const b = inferType(null);
  const merged = mergeFields(a, b);
  assert.equal(merged.nullable, true);
  assert.equal(merged.type.kind, "string");
});
