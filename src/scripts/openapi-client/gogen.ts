import type { Field } from "../json-code/ast.ts";
import { pascalCase } from "../json-code/names.ts";
import type { ClientModel, ClientOperation } from "./clientModel.ts";

export function renderGoClient(model: ClientModel): string {
  const hasBody = model.operations.some((o) => o.body);
  const lines: string[] = [
    "package main",
    "",
    "import (",
    '	"encoding/json"',
    '	"fmt"',
    '	"io"',
    '	"net/http"',
    ...(hasBody ? ['	"bytes"'] : []),
    ")",
    "",
  ];
  for (const type of model.types) {
    lines.push(`type ${type.name} struct {`);
    for (const [key, field] of type.fields) {
      lines.push(`\t${pascalCase(key)} ${goType(field)} \`json:"${key}"\``);
    }
    lines.push("}", "");
  }
  lines.push("type Client struct {");
  lines.push("\tBaseURL string");
  lines.push("}", "");
  lines.push("func NewClient(baseURL string) *Client {");
  lines.push("\treturn &Client{BaseURL: baseURL}");
  lines.push("}", "");
  for (const op of model.operations) {
    lines.push(renderMethod(op));
    lines.push("");
  }
  return lines.join("\n");
}

function renderMethod(op: ClientOperation): string {
  const name = pascalCase(op.name);
  const params = [
    ...op.pathParams.map((p) => `${p.name} ${goType(p.field)}`),
    ...op.queryParams.map((p) =>
      p.required
        ? `${p.name} ${goType(p.field)}`
        : `${p.name} *${goType(p.field)}`,
    ),
    ...(op.body ? [`body ${goType(op.body.field)}`] : []),
  ].join(", ");
  const hasRet = Boolean(op.success?.field);
  const isObj = op.success?.field?.type.kind === "object";
  const retType = hasRet ? goType(op.success!.field!) : "";
  const ret = hasRet ? `(${isObj ? "*" : ""}${retType}, error)` : "error";
  const lines: string[] = [`func (c *Client) ${name}(${params}) ${ret} {`];
  const urlExpr = goUrlExpr(op);
  if (op.body) {
    lines.push("\tjsonBytes, err := json.Marshal(body)");
    lines.push("\tif err != nil {");
    lines.push("\t\treturn nil, err");
    lines.push("\t}");
    lines.push(
      `\treq, err := http.NewRequest("${op.method}", ${urlExpr}, bytes.NewReader(jsonBytes))`,
    );
  } else {
    lines.push(
      `\treq, err := http.NewRequest("${op.method}", ${urlExpr}, nil)`,
    );
  }
  lines.push("\tif err != nil {");
  lines.push("\t\treturn nil, err");
  lines.push("\t}");
  for (const p of op.queryParams) {
    const set = `q.Set("${p.name}", fmt.Sprintf("%v", ${p.required ? p.name : "*" + p.name}))`;
    if (p.required) {
      lines.push("\tq := req.URL.Query()");
      lines.push(`\t${set}`);
      lines.push("\treq.URL.RawQuery = q.Encode()");
    } else {
      lines.push(`\tif ${p.name} != nil {`);
      lines.push("\t\tq := req.URL.Query()");
      lines.push(`\t\t${set}`);
      lines.push("\t\treq.URL.RawQuery = q.Encode()");
      lines.push("\t}");
    }
  }
  lines.push("\tresp, err := http.DefaultClient.Do(req)");
  lines.push("\tif err != nil {");
  lines.push("\t\treturn nil, err");
  lines.push("\t}");
  lines.push("\tdefer resp.Body.Close()");
  lines.push("\tif resp.StatusCode < 200 || resp.StatusCode >= 300 {");
  lines.push("\t\tbody, _ := io.ReadAll(resp.Body)");
  lines.push(
    `\t\treturn nil, fmt.Errorf("${op.method} ${op.path} failed: %d %s", resp.StatusCode, string(body))`,
  );
  lines.push("\t}");
  if (hasRet) {
    lines.push(`\tvar out ${goType(op.success!.field!)}`);
    lines.push(
      "\tif err := json.NewDecoder(resp.Body).Decode(&out); err != nil {",
    );
    lines.push("\t\treturn nil, err");
    lines.push("\t}");
    lines.push(isObj ? "\treturn &out, nil" : "\treturn out, nil");
  } else {
    lines.push("\treturn nil");
  }
  lines.push("}");
  return lines.join("\n");
}

function goUrlExpr(op: ClientOperation): string {
  const segments = op.path.split("/");
  const parts: string[] = [];
  let literal = "";
  const flush = (): void => {
    if (literal) {
      parts.push(JSON.stringify(literal));
      literal = "";
    }
  };
  for (const seg of segments) {
    if (seg === "") continue;
    const m = seg.match(/^\{([^}]+)\}$/);
    if (m) {
      flush();
      parts.push(`fmt.Sprint(${m[1]})`);
    } else {
      literal += "/" + seg;
    }
  }
  flush();
  const chain = parts.map((p) => ` + ${p}`).join("");
  return `c.BaseURL${chain}`;
}

function goType(field: Field): string {
  const t = field.type;
  let base: string;
  if (t.kind === "object") base = t.name ?? "map[string]interface{}";
  else if (t.kind === "array") base = `[]${goType(t.items)}`;
  else if (t.kind === "string") base = "string";
  else if (t.kind === "number") base = "float64";
  else if (t.kind === "boolean") base = "bool";
  else base = "interface{}";
  return field.nullable ? `*${base}` : base;
}
