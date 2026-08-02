import type { Field } from "../json-code/ast.ts";
import { tsIdent } from "../json-code/names.ts";
import type {
  ClientModel,
  ClientOperation,
  ClientParam,
} from "./clientModel.ts";

const SCALARS: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  any: "unknown",
  null: "null",
};

export function renderTsClient(model: ClientModel): string {
  const lines: string[] = [];
  for (const type of model.types) {
    lines.push(`export interface ${type.name} {`);
    for (const [key, field] of type.fields) {
      const opt = field.required ? "" : "?";
      lines.push(`  ${tsIdent(key)}${opt}: ${tsType(field)};`);
    }
    lines.push("}", "");
  }
  lines.push("export class Api {");
  lines.push("  baseUrl: string;");
  lines.push("");
  lines.push(`  constructor(baseUrl = ${JSON.stringify(model.baseUrl)}) {`);
  lines.push('    this.baseUrl = baseUrl.replace(/\\/+$/, "");');
  lines.push("  }");
  lines.push("");
  for (const op of model.operations) {
    lines.push(renderMethod(op));
    lines.push("");
  }
  lines.push("}");
  return lines.join("\n");
}

function renderMethod(op: ClientOperation): string {
  const params = [
    ...op.pathParams.map((p) => `${p.name}: ${tsType(p.field)}`),
    ...op.queryParams.map(
      (p) => `${p.name}${p.required ? "" : "?"}: ${tsType(p.field)}`,
    ),
    ...(op.body ? [`body: ${tsType(op.body.field)}`] : []),
  ].join(", ");
  const ret = op.success?.field ? tsType(op.success.field) : "void";
  const lines: string[] = [`  async ${op.name}(${params}): Promise<${ret}> {`];
  const pathExpr = op.path.replace(/\{([^}]+)\}/g, "${$1}");
  const baseExpr = `${"${this.baseUrl}"}${pathExpr}`;
  if (op.queryParams.length > 0) {
    lines.push("    const query = new URLSearchParams();");
    for (const p of op.queryParams) {
      const set = p.required
        ? `query.set(${JSON.stringify(p.name)}, String(${p.name}));`
        : `if (${p.name} !== undefined) query.set(${JSON.stringify(p.name)}, String(${p.name}));`;
      lines.push(`    ${set}`);
    }
    lines.push("    const qs = query.toString();");
    lines.push(
      `    const url = qs ? \`${baseExpr}?\${qs}\` : \`${baseExpr}\`;`,
    );
  } else {
    lines.push(`    const url = \`${baseExpr}\`;`);
  }
  if (op.body) {
    lines.push(`    const res = await fetch(url, {`);
    lines.push(`      method: ${JSON.stringify(op.method)},`);
    lines.push(
      `      headers: { "Content-Type": ${JSON.stringify(op.body.contentType)} },`,
    );
    lines.push("      body: JSON.stringify(body),");
    lines.push("    });");
  } else {
    lines.push(
      `    const res = await fetch(url, { method: ${JSON.stringify(op.method)} });`,
    );
  }
  lines.push(
    `    if (!res.ok) throw new Error(\`${op.method} ${op.path} failed: \${res.status} \${res.statusText}\`);`,
  );
  if (op.success?.field) lines.push("    return res.json();");
  lines.push("  }");
  return lines.join("\n");
}

export function tsType(field: Field): string {
  const t = field.type;
  let base: string;
  if (t.kind === "object") base = t.name ?? "Record<string, unknown>";
  else if (t.kind === "array") base = tsType(t.items);
  else base = SCALARS[t.kind] ?? "unknown";
  if (field.nullable) base = `(${base} | null)`;
  return t.kind === "array" ? `${base}[]` : base;
}
