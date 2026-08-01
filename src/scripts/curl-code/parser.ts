export interface CurlRequest {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body?: string;
  warnings: string[];
}

const LONG_VALUE = new Set([
  "--request",
  "--header",
  "--data",
  "--data-binary",
  "--data-raw",
  "--user",
  "--form",
]);
const SHORT_VALUE = new Set(["X", "H", "d", "u", "F"]);

export function parseCurl(command: string): CurlRequest {
  const tokens = tokenize(command);
  let url = "";
  let method = "";
  let body: string | undefined;
  const headers: Array<[string, string]> = [];
  const warnings: string[] = [];

  const handleValue = (flag: string, value: string) => {
    if (flag === "-X" || flag === "--request") {
      method = value.toUpperCase();
    } else if (flag === "-H" || flag === "--header") {
      const idx = value.indexOf(":");
      if (idx === -1) warnings.push(`Skipped malformed header: ${value}`);
      else
        headers.push([value.slice(0, idx).trim(), value.slice(idx + 1).trim()]);
    } else if (
      flag === "-d" ||
      flag === "--data" ||
      flag === "--data-binary" ||
      flag === "--data-raw"
    ) {
      if (value.startsWith("@"))
        warnings.push('--data references a file ("@"): inlined literally');
      body = value;
    } else if (flag === "-u" || flag === "--user") {
      try {
        headers.push(["Authorization", "Basic " + btoa(value)]);
      } catch {
        warnings.push("skipped -u: username/password must be ASCII");
      }
    } else if (flag === "-F" || flag === "--form") {
      warnings.push("-F multipart form data is not supported");
    }
  };

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const flag = eq >= 0 ? tok.slice(0, eq) : tok;
      if (LONG_VALUE.has(flag)) {
        const value = eq >= 0 ? tok.slice(eq + 1) : tokens[i + 1];
        if (value === undefined) break;
        if (eq < 0) i++;
        handleValue(flag, value);
      }
    } else if (tok.startsWith("-") && tok.length > 1) {
      const short = tok[1];
      if (SHORT_VALUE.has(short)) {
        const value = tok.length > 2 ? tok.slice(2) : tokens[i + 1];
        if (value === undefined) break;
        if (tok.length === 2) i++;
        handleValue("-" + short, value);
      }
    } else if (!url && tok.toLowerCase() !== "curl") {
      url = tok;
    }
    i++;
  }

  if (!url) throw new Error("No URL found in the curl command.");

  const hasJsonBody = body !== undefined && /^[{[]/.test(body.trim());
  const hasContentType = headers.some(
    ([k]) => k.toLowerCase() === "content-type",
  );
  if (body !== undefined && !hasContentType) {
    headers.push([
      "Content-Type",
      hasJsonBody ? "application/json" : "application/x-www-form-urlencoded",
    ]);
  }

  return {
    method: method || (body !== undefined ? "POST" : "GET"),
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
    warnings,
  };
}

export function isJsonBody(req: CurlRequest): boolean {
  return /^[{[]/.test((req.body ?? "").trim());
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let quoted = false;
  let i = 0;
  const flush = () => {
    if (cur !== "" || quoted) {
      tokens.push(cur);
      cur = "";
      quoted = false;
    }
  };
  while (i < input.length) {
    const c = input[i];
    if (quote) {
      if (c === "\\" && quote === '"') {
        cur += input[i + 1] ?? "";
        i++;
      } else if (c === quote) {
        quote = null;
      } else {
        cur += c;
      }
    } else if (c === "'" || c === '"') {
      quote = c;
      quoted = true;
    } else if (/\s/.test(c)) {
      flush();
    } else if (c === "\\") {
      cur += input[i + 1] ?? "";
      i++;
    } else {
      cur += c;
    }
    i++;
  }
  flush();
  return tokens;
}
