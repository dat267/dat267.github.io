export interface Field {
  type: JsonType;
  nullable: boolean;
  required: boolean;
}

export type JsonType =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "any" }
  | { kind: "null" }
  | { kind: "array"; items: Field }
  | { kind: "object"; fields: Map<string, Field>; name?: string };

export function inferType(value: unknown): Field {
  if (value === null) {
    return { type: { kind: "any" }, nullable: true, required: true };
  }
  return { type: inferNonNull(value), nullable: false, required: true };
}

function inferNonNull(value: unknown): JsonType {
  if (typeof value === "string") return { kind: "string" };
  if (typeof value === "number") return { kind: "number" };
  if (typeof value === "boolean") return { kind: "boolean" };
  if (Array.isArray(value)) {
    let items: Field = {
      type: { kind: "any" },
      nullable: false,
      required: true,
    };
    for (const el of value) items = mergeFields(items, inferType(el));
    return { kind: "array", items };
  }
  if (typeof value === "object") {
    const fields = new Map<string, Field>();
    for (const [key, val] of Object.entries(value))
      fields.set(key, inferType(val));
    return { kind: "object", fields };
  }
  return { kind: "any" };
}

export function mergeFields(a: Field, b: Field): Field {
  return {
    type: mergeTypes(a.type, b.type),
    nullable: a.nullable || b.nullable,
    required: a.required && b.required,
  };
}

function mergeTypes(a: JsonType, b: JsonType): JsonType {
  if (a.kind === "any") return b.kind === "any" ? a : b;
  if (b.kind === "any") return a;
  if (a.kind === "null") return b;
  if (b.kind === "null") return a;
  if (a.kind !== b.kind) return { kind: "any" };
  if (a.kind === "array" && b.kind === "array") {
    return { kind: "array", items: mergeFields(a.items, b.items) };
  }
  if (a.kind === "object" && b.kind === "object") {
    return { kind: "object", fields: mergeMaps(a.fields, b.fields) };
  }
  return a;
}

function mergeMaps(
  a: Map<string, Field>,
  b: Map<string, Field>,
): Map<string, Field> {
  const out = new Map<string, Field>();
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) {
    const fa = a.get(key);
    const fb = b.get(key);
    if (fa && fb) out.set(key, mergeFields(fa, fb));
    else if (fa) out.set(key, { ...fa, required: false });
    else if (fb) out.set(key, { ...fb, required: false });
  }
  return out;
}
