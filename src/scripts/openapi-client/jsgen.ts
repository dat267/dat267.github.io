import type {
  ClientModel,
  ClientOperation,
  ClientParam,
} from "./clientModel.ts";

export function renderJsClient(model: ClientModel): string {
  const lines: string[] = [
    "export class Api {",
    "  baseUrl;",
    "",
    `  constructor(baseUrl = ${JSON.stringify(model.baseUrl)}) {`,
    '    this.baseUrl = baseUrl.replace(/\\/+$/, "");',
    "  }",
    "",
  ];
  for (const op of model.operations) {
    lines.push(renderMethod(op));
    lines.push("");
  }
  lines.push("}");
  return lines.join("\n");
}

function renderMethod(op: ClientOperation): string {
  const params = [
    ...op.pathParams.map((p) => p.name),
    ...op.queryParams.map((p) => p.name),
    ...(op.body ? ["body"] : []),
  ].join(", ");
  const lines: string[] = [`  async ${op.name}(${params}) {`];
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
    lines.push("    const res = await fetch(url, {");
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
