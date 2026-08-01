import type { Field } from "./ast.ts";
import { collectObjects, rustIdent } from "./names.ts";

export function generateRust(root: Field, rootName: string): string {
  const header = "use serde::{Deserialize, Serialize};";
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType)
    return `${header}\n\npub type ${rootName} = ${rustType(root)};\n`;
  const lines = [header, ""];
  for (const t of all) {
    lines.push(
      "#[derive(Serialize, Deserialize, Debug)]",
      `pub struct ${t.name} {`,
    );
    for (const [key, field] of t.fields) {
      const ident = rustIdent(key);
      if (ident !== key) lines.push(`    #[serde(rename = "${key}")]`);
      lines.push(`    pub ${ident}: ${rustType(field)},`);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

function rustType(field: Field): string {
  const t = field.type;
  let base: string;
  switch (t.kind) {
    case "object":
      base = t.name ?? "serde_json::Value";
      break;
    case "array":
      base = `Vec<${rustType(t.items)}>`;
      break;
    case "string":
      base = "String";
      break;
    case "number":
      base = "f64";
      break;
    case "boolean":
      base = "bool";
      break;
    default:
      base = "serde_json::Value";
  }
  return field.nullable ? `Option<${base}>` : base;
}
