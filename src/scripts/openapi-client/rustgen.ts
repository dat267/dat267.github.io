import type { Field } from "../json-code/ast.ts";
import { rustIdent, snakeCase } from "../json-code/names.ts";
import type { ClientModel, ClientOperation } from "./clientModel.ts";

const COMMON_METHODS = new Set([
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "head",
  "options",
]);

export function renderRsClient(model: ClientModel): string {
  const lines: string[] = [
    "use reqwest;",
    "use serde::{Deserialize, Serialize};",
    "",
  ];
  for (const type of model.types) {
    lines.push(
      "#[derive(Serialize, Deserialize, Debug)]",
      `pub struct ${type.name} {`,
    );
    for (const [key, field] of type.fields) {
      const ident = rustIdent(key);
      const rename = ident === key ? "" : `\n    #[serde(rename = "${key}")]`;
      lines.push(`${rename}\n    pub ${ident}: ${rustType(field)},`);
    }
    lines.push("}", "");
  }
  lines.push("pub struct Api {");
  lines.push("    pub base_url: String,");
  lines.push("    client: reqwest::Client,");
  lines.push("}", "");
  lines.push("impl Api {");
  lines.push("    pub fn new(base_url: &str) -> Self {");
  lines.push("        Self {");
  lines.push(
    "            base_url: base_url.trim_end_matches('/').to_string(),",
  );
  lines.push("            client: reqwest::Client::new(),");
  lines.push("        }");
  lines.push("    }");
  lines.push("");
  for (const op of model.operations) {
    lines.push(renderMethod(op));
    lines.push("");
  }
  lines.push("}");
  return lines.join("\n");
}

function renderMethod(op: ClientOperation): string {
  const name = snakeCase(op.name);
  const params = [
    "&self",
    ...op.pathParams.map((p) => `${rustIdent(p.name)}: ${rustType(p.field)}`),
    ...op.queryParams.map(
      (p) =>
        `${rustIdent(p.name)}: ${p.required ? rustType(p.field) : `Option<${rustType(p.field)}>`}`,
    ),
    ...(op.body ? [`body: &${rustType(op.body.field)}`] : []),
  ].join(", ");
  const ret = op.success?.field ? rustType(op.success.field) : "()";
  const lines: string[] = [
    `    pub async fn ${name}(${params}) -> Result<${ret}, reqwest::Error> {`,
  ];
  const fmtPath = op.path.replace(/\{([^}]+)\}/g, "{}");
  const args = op.pathParams.map((p) => rustIdent(p.name));
  const urlExpr =
    args.length > 0
      ? `format!("{}{}", self.base_url, ${JSON.stringify(fmtPath)}${args.map((a) => `, ${a}`).join("")})`
      : `format!("{}{}", self.base_url, ${JSON.stringify(op.path)})`;
  lines.push(`        let url = ${urlExpr};`);
  const m = op.method.toLowerCase();
  const methodStep = COMMON_METHODS.has(m)
    ? `        .${m}(&url)`
    : `        .method(reqwest::Method::from_bytes(b"${op.method}")?)\n        .url(&url)`;
  const steps = ["        let res = self", "            .client", methodStep];
  if (op.queryParams.length > 0) {
    const pairs = op.queryParams
      .map((p) => `("${p.name}", ${rustIdent(p.name)})`)
      .join(", ");
    steps.push(`            .query(&[${pairs}])`);
  }
  if (op.body) steps.push("            .json(body)");
  steps.push(
    "            .send()",
    "            .await?",
    "            .error_for_status()?;",
  );
  lines.push(...steps);
  if (op.success?.field) {
    lines.push("        Ok(res.json().await?)");
  } else {
    lines.push("        Ok(())");
  }
  lines.push("    }");
  return lines.join("\n");
}

function rustType(field: Field): string {
  const t = field.type;
  let base: string;
  if (t.kind === "object") base = t.name ?? "serde_json::Value";
  else if (t.kind === "array") base = `Vec<${rustType(t.items)}>`;
  else if (t.kind === "string") base = "String";
  else if (t.kind === "number") base = "f64";
  else if (t.kind === "boolean") base = "bool";
  else base = "serde_json::Value";
  return field.nullable ? `Option<${base}>` : base;
}
