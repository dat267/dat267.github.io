import type { Field } from "../json-code/ast.ts";
import { pyIdent, snakeCase } from "../json-code/names.ts";
import type { ClientModel, ClientOperation } from "./clientModel.ts";

export function renderPyClient(model: ClientModel): string {
  const lines: string[] = [
    "from __future__ import annotations",
    "from dataclasses import dataclass, asdict",
    "from typing import Any, Optional",
    "import requests",
    "",
  ];
  for (const type of model.types) {
    lines.push("@dataclass", `class ${type.name}:`);
    const withoutDefault: string[] = [];
    const withDefault: string[] = [];
    for (const [key, field] of type.fields) {
      const defaultable = field.nullable || !field.required;
      const annotation =
        defaultable && !field.nullable
          ? `Optional[${pyType(field)}]`
          : pyType(field);
      const line = defaultable
        ? `    ${pyIdent(key)}: ${annotation} = None`
        : `    ${pyIdent(key)}: ${annotation}`;
      (defaultable ? withDefault : withoutDefault).push(line);
    }
    lines.push(...withoutDefault, ...withDefault, "");
  }
  lines.push("class Api:");
  lines.push(
    `    def __init__(self, base_url: str = ${JSON.stringify(model.baseUrl)}):`,
  );
  lines.push('        self.base_url = base_url.rstrip("/")');
  lines.push("");
  for (const op of model.operations) {
    lines.push(renderMethod(op));
    lines.push("");
  }
  return lines.join("\n");
}

function renderMethod(op: ClientOperation): string {
  const name = snakeCase(op.name);
  const params = [
    "self",
    ...op.pathParams.map((p) => `${p.name}: ${pyType(p.field)}`),
    ...op.queryParams.map((p) =>
      p.required
        ? `${p.name}: ${pyType(p.field)}`
        : `${p.name}: Optional[${pyType(p.field)}] = None`,
    ),
    ...(op.body ? [`body: ${pyType(op.body.field)}`] : []),
  ].join(", ");
  const ret = op.success?.field ? pyType(op.success.field) : "None";
  const lines: string[] = [`    def ${name}(${params}) -> ${ret}:`];
  if (op.queryParams.length > 0) {
    const requiredParams = op.queryParams.filter((p) => p.required);
    const optionalParams = op.queryParams.filter((p) => !p.required);
    if (requiredParams.length > 0) {
      const reqDict = requiredParams
        .map((p) => `${JSON.stringify(p.name)}: ${p.name}`)
        .join(", ");
      if (optionalParams.length > 0) {
        lines.push(`        params = {${reqDict}}`);
        for (const p of optionalParams) {
          lines.push(`        if ${p.name} is not None:`);
          lines.push(
            `            params[${JSON.stringify(p.name)}] = ${p.name}`,
          );
        }
      } else {
        lines.push(`        params = {${reqDict}}`);
      }
    } else {
      lines.push(
        `        params = {${optionalParams.map((p) => `${JSON.stringify(p.name)}: ${p.name}`).join(", ")}}`,
      );
      lines.push(
        `        params = {k: v for k, v in params.items() if v is not None}`,
      );
    }
  }
  const pathExpr = op.path; // /users/{id} — valid inside an f-string
  const urlArg = op.queryParams.length > 0 ? ", params=params" : "";
  const requestLine = op.body
    ? `        response = requests.${op.method.toLowerCase()}(f"{self.base_url}${pathExpr}", headers={"Content-Type": ${JSON.stringify(op.body.contentType)}}, json=payload${urlArg})`
    : `        response = requests.${op.method.toLowerCase()}(f"{self.base_url}${pathExpr}"${urlArg})`;
  if (op.body) {
    lines.push(
      '        payload = asdict(body) if hasattr(body, "__dataclass_fields__") else body',
    );
  }
  lines.push(requestLine);
  lines.push("        response.raise_for_status()");
  const success = op.success?.field;
  if (success) {
    if (success.type.kind === "object" && success.type.name) {
      lines.push(`        return ${success.type.name}(**response.json())`);
    } else {
      lines.push("        return response.json()");
    }
  }
  return lines.join("\n");
}

function pyType(field: Field): string {
  const t = field.type;
  let base: string;
  if (t.kind === "object") base = t.name ?? "Any";
  else if (t.kind === "array") base = `list[${pyType(t.items)}]`;
  else if (t.kind === "string") base = "str";
  else if (t.kind === "number") base = "float";
  else if (t.kind === "boolean") base = "bool";
  else base = "Any";
  return field.nullable ? `Optional[${base}]` : base;
}
