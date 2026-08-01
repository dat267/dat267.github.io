import type { CurlRequest } from "./parser.ts";

export function generatePowerShell(req: CurlRequest): string {
  const lines: string[] = [];
  if (req.headers.length) {
    lines.push("$headers = @{");
    for (const [k, v] of req.headers) {
      lines.push(`    ${psStr(k)} = ${psStr(v)}`);
    }
    lines.push("}", "");
  }
  if (req.body !== undefined) {
    lines.push(`$body = ${psStr(req.body)}`, "");
  }
  const method = req.method[0] + req.method.slice(1).toLowerCase();
  const parts = [
    "Invoke-RestMethod \\",
    `    -Method ${method} \\`,
    `    -Uri ${psStr(req.url)} \\`,
  ];
  if (req.headers.length) parts.push("    -Headers $headers \\");
  if (req.body !== undefined) parts.push("    -Body $body");
  else parts[parts.length - 1] = parts[parts.length - 1].replace(/ \\$/, "");
  lines.push(parts.join("\n"));
  return lines.join("\n") + "\n";
}

function psStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
