import { strict as assert } from "node:assert";
import { test } from "node:test";
import { schemaToField } from "./schemaToField.ts";
import type { JsonSchema } from "./specParser.ts";

const resolve = () => undefined;

test("scalar types", () => {
  assert.deepEqual(schemaToField({ type: "string" }, resolve), {
    type: { kind: "string" },
    nullable: false,
    required: true,
  });
  assert.equal(schemaToField({ type: "integer" }, resolve).type.kind, "number");
  assert.equal(
    schemaToField({ type: "boolean" }, resolve).type.kind,
    "boolean",
  );
});

test("nullable via type array and nullable flag", () => {
  const a = schemaToField({ type: ["string", "null"] }, resolve);
  assert.equal(a.nullable, true);
  assert.equal(a.type.kind, "string");
  const b = schemaToField({ type: "string", nullable: true }, resolve);
  assert.equal(b.nullable, true);
});

test("object with required fields", () => {
  const f = schemaToField(
    {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        nick: { type: "string" },
      },
      required: ["id", "name"],
    },
    resolve,
  );
  assert.equal(f.type.kind, "object");
  if (f.type.kind === "object") {
    assert.equal(f.type.fields.get("id")?.required, true);
    assert.equal(f.type.fields.get("name")?.required, true);
    assert.equal(f.type.fields.get("nick")?.required, false);
  }
});

test("array with items", () => {
  const f = schemaToField(
    { type: "array", items: { type: "string" } },
    resolve,
  );
  assert.equal(f.type.kind, "array");
  if (f.type.kind === "array") assert.equal(f.type.items.type.kind, "string");
});

test("empty array items become any", () => {
  const f = schemaToField({ type: "array" }, resolve);
  if (f.type.kind === "array") assert.equal(f.type.items.type.kind, "any");
});

test("allOf merges schemas", () => {
  const f = schemaToField(
    {
      allOf: [
        {
          type: "object",
          properties: { a: { type: "string" } },
          required: ["a"],
        },
        { type: "object", properties: { b: { type: "boolean" } } },
      ],
    },
    resolve,
  );
  assert.equal(f.type.kind, "object");
  if (f.type.kind === "object") {
    assert.equal(f.type.fields.size, 2);
    assert.equal(f.type.fields.get("a")?.required, true);
  }
});

test("bare refs stay named references", () => {
  const schemas = {
    User: { type: "object", properties: { id: { type: "integer" } } },
  };
  const f = schemaToField(
    { $ref: "#/components/schemas/User" },
    (ref) => schemas[ref.split("/").pop()!],
  );
  assert.equal(f.type.kind, "object");
  assert.equal(f.type.name, "User");
  assert.equal(f.type.fields.size, 0);
});

test("unresolvable ref becomes any", () => {
  assert.equal(
    schemaToField({ $ref: "#/components/schemas/Missing" }, () => undefined)
      .type.kind,
    "any",
  );
});

test("no type and no properties becomes any", () => {
  assert.equal(schemaToField({}, resolve).type.kind, "any");
});
