import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateJsonSchema } from "./jsongen.ts";

test("generates draft-07 schema with definitions", () => {
  const root = inferType([
    { id: 1, name: "a", age: null, tags: ["x"], meta: { ok: true } },
    { id: 2, name: "b", age: 30, tags: [], meta: { ok: false } },
  ]);
  const schema = JSON.parse(generateJsonSchema(root, "User"));
  assert.equal(schema.$ref, "#/definitions/User");
  assert.equal(schema.definitions.User.properties.id.type, "number");
  assert.deepEqual(schema.definitions.User.properties.age.type, [
    "number",
    "null",
  ]);
  assert.equal(schema.definitions.User.properties.tags.type, "array");
  assert.equal(
    schema.definitions.User.properties.meta.$ref,
    "#/definitions/Meta",
  );
  assert.deepEqual(schema.definitions.User.required, [
    "id",
    "name",
    "age",
    "tags",
    "meta",
  ]);
  assert.equal(schema.definitions.User.additionalProperties, false);
});

test("marks only universally-present keys required", () => {
  const root = inferType([{ a: 1 }, { a: 2, b: "x" }]);
  const schema = JSON.parse(generateJsonSchema(root, "Row"));
  assert.deepEqual(schema.definitions.Row.required, ["a"]);
});

test("scalar top-level input emits inline schema", () => {
  const schema = JSON.parse(generateJsonSchema(inferType(42), "Root"));
  assert.equal(schema.type, "number");
});
