import type { CurlRequest } from "./parser.ts";

const COMMON = new Set([
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "head",
  "options",
]);

export function generateRust(req: CurlRequest): string {
  const m = req.method.toLowerCase();
  const lines = ["let client = reqwest::Client::new();", "let resp = client"];
  if (COMMON.has(m)) {
    lines.push(`    .${m}(${JSON.stringify(req.url)})`);
  } else {
    lines.push(`    .method(reqwest::Method::from_bytes(b"${req.method}")?)`);
    lines.push(`    .url(${JSON.stringify(req.url)})`);
  }
  for (const [k, v] of req.headers) {
    lines.push(`    .header(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }
  if (req.body !== undefined) {
    let hashes = "#";
    while (req.body.includes('"' + hashes)) hashes += "#";
    lines.push(`    .body(r${hashes}${req.body}${hashes})`);
  }
  lines.push("    .send()");
  lines.push("    .await?;");
  return lines.join("\n") + "\n";
}
