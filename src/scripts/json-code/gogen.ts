import type { Field } from "./ast.ts";
import { collectObjects, pascalCase } from "./names.ts";

export function generateGo(root: Field, rootName: string): string {
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) return `type ${rootName} ${goType(root)}\n`;
  const lines: string[] = ["package main", ""];
  for (const t of all) {
    lines.push(`type ${t.name} struct {`);
    for (const [key, field] of t.fields) {
      lines.push(`\t${pascalCase(key)} ${goType(field)} \`json:"${key}"\``);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

function goType(field: Field): string {
  const t = field.type;
  let base: string;
  switch (t.kind) {
    case "object":
      base = t.name ?? "map[string]interface{}";
      break;
    case "array":
      base = `[]${goType(t.items)}`;
      break;
    case "string":
      base = "string";
      break;
    case "number":
      base = "float64";
      break;
    case "boolean":
      base = "bool";
      break;
    default:
      base = "interface{}";
  }
  return field.nullable ? `*${base}` : base;
}
