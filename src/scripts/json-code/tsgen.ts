import type { Field, JsonType } from "./ast.ts";
import { collectObjects, tsIdent } from "./names.ts";

export function generateTypeScript(root: Field, rootName: string): string {
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) return `export type ${rootName} = ${tsType(root)};\n`;
  const lines: string[] = [];
  for (const t of all) {
    lines.push(`export interface ${t.name} {`);
    for (const [key, field] of t.fields) {
      const opt = field.required ? "" : "?";
      lines.push(`  ${tsIdent(key)}${opt}: ${tsType(field)};`);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

function tsType(field: Field): string {
  const t = field.type;
  let base: string;
  if (t.kind === "object") base = t.name ?? "Record<string, unknown>";
  else if (t.kind === "array") base = tsType(t.items);
  else base = scalar(t);
  if (field.nullable) base = `(${base} | null)`;
  return t.kind === "array" ? `${base}[]` : base;
}

function scalar(t: JsonType): string {
  switch (t.kind) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "any":
      return "unknown";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}
