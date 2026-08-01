import type { Field, JsonType } from "./ast.ts";
import { collectObjects } from "./names.ts";

const SCHEMA_URL = "http://json-schema.org/draft-07/schema#";

export function generateJsonSchema(root: Field, rootName: string): string {
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) {
    return JSON.stringify(
      { $schema: SCHEMA_URL, ...fieldSchema(root) },
      null,
      2,
    );
  }
  const definitions: Record<string, unknown> = {};
  for (const t of all) definitions[t.name] = objectSchema(t.fields);
  const schema = {
    $schema: SCHEMA_URL,
    $ref: `#/definitions/${rootType.name}`,
    definitions,
  };
  return JSON.stringify(schema, null, 2);
}

function objectSchema(fields: Map<string, Field>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of fields) {
    properties[key] = fieldSchema(field);
    if (field.required) required.push(key);
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  };
}

function fieldSchema(field: Field): Record<string, unknown> {
  const schema = baseSchema(field.type);
  if (field.nullable && "type" in schema) {
    const type = Array.isArray(schema.type) ? schema.type : [schema.type];
    return { ...schema, type: [...type, "null"] };
  }
  return schema;
}

function baseSchema(t: JsonType): Record<string, unknown> {
  switch (t.kind) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "any":
      return {};
    case "array":
      return { type: "array", items: fieldSchema(t.items) };
    case "object":
      return { $ref: `#/definitions/${t.name}` };
  }
}
