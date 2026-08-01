import type { Field } from "./ast.ts";
import { collectObjects, pyIdent } from "./names.ts";

export function generatePython(root: Field, rootName: string): string {
  const header = [
    "from __future__ import annotations",
    "from dataclasses import dataclass",
    "from typing import Any, Optional",
    "",
  ];
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType)
    return [...header, `${rootName} = ${pyType(root)}`, ""].join("\n");
  const lines = [...header];
  for (const t of all) {
    lines.push("@dataclass", `class ${t.name}:`);
    const withoutDefault: string[] = [];
    const withDefault: string[] = [];
    for (const [key, field] of t.fields) {
      const defaultable = field.nullable || !field.required;
      const line = defaultable
        ? `    ${pyIdent(key)}: ${pyType(field)} = None`
        : `    ${pyIdent(key)}: ${pyType(field)}`;
      (defaultable ? withDefault : withoutDefault).push(line);
    }
    lines.push(...withoutDefault, ...withDefault, "");
  }
  return lines.join("\n");
}

function pyType(field: Field): string {
  const t = field.type;
  let base: string;
  switch (t.kind) {
    case "object":
      base = t.name ?? "Any";
      break;
    case "array":
      base = `list[${pyType(t.items)}]`;
      break;
    case "string":
      base = "str";
      break;
    case "number":
      base = "float";
      break;
    case "boolean":
      base = "bool";
      break;
    default:
      base = "Any";
  }
  return field.nullable || !field.required ? `Optional[${base}]` : base;
}
