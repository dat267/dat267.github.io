import type { CurlRequest } from "./parser.ts";

export function generateGo(req: CurlRequest): string {
  const lines: string[] = [];
  const hasBody = req.body !== undefined;
  lines.push('// import "net/http"' + (hasBody ? ' and "bytes"' : ""));
  const bodyArg = hasBody
    ? `bytes.NewBufferString(${JSON.stringify(req.body)})`
    : "nil";
  lines.push(
    `req, err := http.NewRequest(${JSON.stringify(req.method)}, ${JSON.stringify(req.url)}, ${bodyArg})`,
  );
  lines.push("if err != nil {");
  lines.push("    panic(err)");
  lines.push("}");
  for (const [k, v] of req.headers) {
    lines.push(`req.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }
  lines.push("resp, err := http.DefaultClient.Do(req)");
  lines.push("if err != nil {");
  lines.push("    panic(err)");
  lines.push("}");
  lines.push("defer resp.Body.Close()");
  return lines.join("\n") + "\n";
}
