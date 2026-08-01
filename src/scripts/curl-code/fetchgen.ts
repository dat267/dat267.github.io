import { isJsonBody, type CurlRequest } from "./parser.ts";

export function generateFetch(req: CurlRequest): string {
  const opts: string[] = [];
  if (req.method !== "GET" || req.body !== undefined) {
    opts.push(`  method: ${JSON.stringify(req.method)},`);
  }
  if (req.headers.length) {
    const items = req.headers.map(
      ([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`,
    );
    opts.push("  headers: {\n" + items.join("\n") + "\n  },");
  }
  if (req.body !== undefined) {
    const body = isJsonBody(req)
      ? `JSON.stringify(${req.body})`
      : JSON.stringify(req.body);
    opts.push(`  body: ${body},`);
  }
  if (!opts.length) return `fetch(${JSON.stringify(req.url)});\n`;
  return `fetch(${JSON.stringify(req.url)}, {\n${opts.join("\n")}\n});\n`;
}
