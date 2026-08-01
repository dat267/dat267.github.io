import { isJsonBody, type CurlRequest } from "./parser.ts";

export function generatePython(req: CurlRequest): string {
  const lines = ["import requests", ""];
  if (req.headers.length) {
    lines.push("headers = {");
    for (const [k, v] of req.headers) {
      lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    }
    lines.push("}", "");
  }
  const kwargs = [
    `    method=${JSON.stringify(req.method)}`,
    `    url=${JSON.stringify(req.url)}`,
  ];
  if (req.headers.length) kwargs.push("    headers=headers,");
  if (req.body !== undefined) {
    if (isJsonBody(req)) {
      try {
        kwargs.push(`    json=${toPyLiteral(JSON.parse(req.body))},`);
      } catch {
        req.warnings.push(
          "body looked like JSON but could not be parsed; sent as data",
        );
        kwargs.push(`    data=${JSON.stringify(req.body)},`);
      }
    } else {
      kwargs.push(`    data=${JSON.stringify(req.body)},`);
    }
  }
  kwargs.push(")");
  lines.push("response = requests.request(");
  lines.push(...kwargs);
  return lines.join("\n") + "\n";
}

function toPyLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPyLiteral).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${toPyLiteral(v)}`)
      .join(", ")}}`;
  }
  return "None";
}
