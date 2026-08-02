import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType, mergeFields } from "../json-code/ast.ts";
import { schemaFromField } from "./schema.ts";

test("scalars", () => {
  assert.deepEqual(schemaFromField(inferType("x")), { type: "string" });
  assert.deepEqual(schemaFromField(inferType(3)), { type: "number" });
  assert.deepEqual(schemaFromField(inferType(true)), { type: "boolean" });
});

test("nullable becomes a type array", () => {
  const f = mergeFields(inferType(1), inferType(null));
  assert.deepEqual(schemaFromField(f), { type: ["number", "null"] });
});

test("arrays and nested objects", () => {
  const f = inferType({ tags: ["a", "b"], meta: { ok: true } });
  assert.deepEqual(schemaFromField(f), {
    type: "object",
    additionalProperties: false,
    properties: {
      tags: { type: "array", items: { type: "string" } },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
    },
    required: ["tags", "meta"],
  });
});

test("heterogeneous array collapses to open schema", () => {
  assert.deepEqual(schemaFromField(inferType([1, "x"])), {
    type: "array",
    items: {},
  });
});
