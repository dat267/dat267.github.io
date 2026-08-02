import type { Field, JsonType } from "../json-code/ast.ts";

export type JsonSchema = Record<string, unknown>;

export function schemaFromField(field: Field): JsonSchema {
  const schema = baseSchema(field.type);
  if (field.nullable && "type" in schema) {
    const type = Array.isArray(schema.type) ? schema.type : [schema.type];
    return { ...schema, type: [...type, "null"] };
  }
  return schema;
}

function baseSchema(t: JsonType): JsonSchema {
  switch (t.kind) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
    case "any":
      return {};
    case "array":
      return { type: "array", items: schemaFromField(t.items) };
    case "object": {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, f] of t.fields) {
        properties[key] = schemaFromField(f);
        if (f.required) required.push(key);
      }
      return {
        type: "object",
        additionalProperties: false,
        properties,
        ...(required.length ? { required } : {}),
      };
    }
  }
}
