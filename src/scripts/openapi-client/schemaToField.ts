import type { Field, JsonType } from "../json-code/ast.ts";
import type { JsonSchema } from "./specParser.ts";

export type RefResolver = (ref: string) => JsonSchema | undefined;

function mergeAllOf(a: Field, b: Field): Field {
  return {
    type: mergeAllOfTypes(a.type, b.type),
    nullable: a.nullable || b.nullable,
    required: a.required || b.required,
  };
}

function mergeAllOfTypes(a: JsonType, b: JsonType): JsonType {
  if (a.kind === "any") return b;
  if (b.kind === "any") return a;
  if (a.kind === "object" && b.kind === "object") {
    const fields = new Map(a.fields);
    for (const [key, fb] of b.fields) {
      const fa = fields.get(key);
      fields.set(key, fa ? { ...mergeAllOf(fa, fb) } : { ...fb });
    }
    return { kind: "object", fields };
  }
  if (a.kind === "array" && b.kind === "array") {
    return { kind: "array", items: mergeAllOf(a.items, b.items) };
  }
  return { kind: "any" };
}

export function schemaToField(
  schema: JsonSchema | undefined,
  resolveRef: RefResolver,
  seen = new Set<string>(),
): Field {
  if (!schema || typeof schema !== "object") {
    return { type: { kind: "any" }, nullable: false, required: true };
  }
  const ref = schema.$ref;
  if (typeof ref === "string") {
    const refName = ref.split("/").pop() ?? "Type";
    if (seen.has(refName)) {
      return {
        type: { kind: "object", fields: new Map(), name: refName },
        nullable: false,
        required: true,
      };
    }
    const next = resolveRef(ref);
    if (!next)
      return { type: { kind: "any" }, nullable: false, required: true };
    return {
      type: { kind: "object", fields: new Map(), name: refName },
      nullable: false,
      required: true,
    };
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf
      .map((s) => {
        const memberRef = s?.$ref;
        if (typeof memberRef === "string") {
          const memberName = memberRef.split("/").pop() ?? "Type";
          const next = resolveRef(memberRef);
          if (!next)
            return { type: { kind: "any" }, nullable: false, required: true };
          const nextSeen = new Set(seen);
          nextSeen.add(memberName);
          return schemaToField(next, resolveRef, nextSeen);
        }
        return schemaToField(s, resolveRef, seen);
      })
      .reduce(mergeAllOf, {
        type: { kind: "any" },
        nullable: false,
        required: true,
      });
  }
  const rawTypes = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  const nullable = rawTypes.includes("null") || schema.nullable === true;
  const nonNull = rawTypes.filter((t) => t !== "null");
  const primary = nonNull[0];
  if (primary === "object" || (primary === undefined && schema.properties)) {
    const fields = new Map<string, Field>();
    const requiredSet = new Set(
      Array.isArray(schema.required) ? schema.required : [],
    );
    for (const [key, prop] of Object.entries(
      (schema.properties ?? {}) as Record<string, JsonSchema>,
    )) {
      fields.set(key, {
        ...schemaToField(prop, resolveRef, seen),
        required: requiredSet.has(key),
      });
    }
    return { type: { kind: "object", fields }, nullable, required: true };
  }
  if (primary === "array") {
    return {
      type: {
        kind: "array",
        items: schemaToField(
          (schema.items as JsonSchema) ?? {},
          resolveRef,
          seen,
        ),
      },
      nullable,
      required: true,
    };
  }
  const kind =
    primary === "string"
      ? "string"
      : primary === "number" || primary === "integer"
        ? "number"
        : primary === "boolean"
          ? "boolean"
          : "any";
  return { type: { kind }, nullable, required: true };
}
