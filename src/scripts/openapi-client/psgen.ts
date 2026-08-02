import type { Field } from "../json-code/ast.ts";
import { pascalCase } from "../json-code/names.ts";
import type { ClientModel, ClientOperation } from "./clientModel.ts";

const VERBS: Record<string, string> = {
  GET: "Get",
  POST: "New",
  PUT: "Set",
  PATCH: "Update",
  DELETE: "Remove",
};

export function renderPsClient(model: ClientModel): string {
  const lines: string[] = [];
  for (const op of model.operations) {
    lines.push(renderFunction(op, model));
    lines.push("");
  }
  return lines.join("\n");
}

function renderFunction(op: ClientOperation, model: ClientModel): string {
  const verb = VERBS[op.method] ?? "Invoke";
  const noun = pascalCase(
    op.name.replace(
      /^(get|post|put|patch|delete|list|create|update|remove)/,
      "",
    ),
  );
  const lines: string[] = [
    `function ${verb}-${noun} {`,
    "    [CmdletBinding()]",
    "    param(",
  ];
  const params: string[] = [];
  for (const p of op.pathParams) {
    params.push(
      `        [Parameter(Mandatory)]`,
      `        [${psType(p.field)}]$${pascalCase(p.name)}`,
    );
  }
  for (const p of op.queryParams) {
    params.push(`        [${psType(p.field)}]$${pascalCase(p.name)}`);
  }
  if (op.body) params.push("        [object]$Body");
  params.push(`        [string]$BaseUrl = ${psStr(model.baseUrl)}`);
  lines.push(params.join(",\n"), "    )");
  if (op.queryParams.length > 0) {
    lines.push("    $params = @{}");
    for (const p of op.queryParams) {
      lines.push(
        `    if ($PSBoundParameters.ContainsKey('${pascalCase(p.name)}')) { $params['${p.name}'] = $${pascalCase(p.name)} }`,
      );
    }
  }
  const pathWithVars = op.path.replace(
    /\{([^}]+)\}/g,
    (_, n: string) => `$${pascalCase(n)}`,
  );
  const uriExpr = `"${"$BaseUrl"}${pathWithVars}"`;
  if (op.queryParams.length > 0) {
    lines.push(`    $uri = ${uriExpr}`);
    lines.push("    if ($params.Count -gt 0) {");
    lines.push(
      '        $uri = "$uri?" + (($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" }) -join \'&\')',
    );
    lines.push("    }");
  } else {
    lines.push(`    $uri = ${uriExpr}`);
  }
  const bodyFlag = op.body ? " -Body ($Body | ConvertTo-Json)" : "";
  lines.push(
    `    return Invoke-RestMethod -Method ${verb} -Uri $uri${bodyFlag}`,
  );
  lines.push("}");
  return lines.join("\n");
}

function psType(field: Field): string {
  const t = field.type;
  switch (t.kind) {
    case "number":
      return "double";
    case "boolean":
      return "bool";
    case "object":
    case "array":
      return "object";
    default:
      return "string";
  }
}

function psStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
