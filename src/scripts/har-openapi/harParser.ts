import type { HarFile } from "./harTypes.ts";

export interface ParsedEntry {
  origin: string;
  path: string;
  method: string;
  query: Array<[string, string]>;
  requestHeaders: Array<[string, string]>;
  requestBody?: string;
  requestContentType?: string;
  status: number;
  responseBody?: string;
  responseContentType?: string;
  hasBasicAuth: boolean;
}

export function parseHar(har: unknown, warnings: string[]): ParsedEntry[] {
  const log = (har as HarFile)?.log;
  const rawEntries = log?.entries;
  if (!Array.isArray(rawEntries)) {
    throw new Error("Invalid HAR: expected log.entries to be an array.");
  }
  const out: ParsedEntry[] = [];
  for (const raw of rawEntries) {
    const req = raw?.request;
    const res = raw?.response;
    if (!req || typeof req.url !== "string" || typeof req.method !== "string") {
      warnings.push("Skipped an entry missing request.url or request.method.");
      continue;
    }
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      warnings.push(`Skipped entry with unparseable URL: ${req.url}`);
      continue;
    }
    const method = req.method.toUpperCase();
    const query: Array<[string, string]> = [];
    url.searchParams.forEach((value, key) => query.push([key, value]));
    const requestHeaders = normalizeHeaders(req.headers);
    const hasBasicAuth = requestHeaders.some(
      ([name, value]) =>
        name.toLowerCase() === "authorization" && /^basic\b/i.test(value),
    );
    let requestBody: string | undefined;
    let requestContentType: string | undefined;
    if (req.postData && typeof req.postData.text === "string") {
      requestBody = req.postData.text;
      requestContentType = req.postData.mimeType;
    }
    let responseBody: string | undefined;
    let responseContentType: string | undefined;
    if (res?.content) {
      responseContentType = res.content.mimeType;
      if (typeof res.content.text === "string") {
        if (res.content.encoding === "base64") {
          try {
            responseBody = decodeBase64(res.content.text);
          } catch {
            warnings.push(
              `Skipped unparseable base64 response body for ${method} ${url.pathname}.`,
            );
          }
        } else {
          responseBody = res.content.text;
        }
      }
    }
    out.push({
      origin: url.origin,
      path: url.pathname,
      method,
      query,
      requestHeaders,
      status: typeof res?.status === "number" ? res.status : 0,
      hasBasicAuth,
      ...(requestBody !== undefined ? { requestBody, requestContentType } : {}),
      ...(responseBody !== undefined
        ? { responseBody, responseContentType }
        : {}),
    });
  }
  return out;
}

function normalizeHeaders(
  headers: Array<{ name: string; value: string }> | undefined,
): Array<[string, string]> {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => h && typeof h.name === "string")
    .map((h) => [h.name, typeof h.value === "string" ? h.value : ""]);
}

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned))
    throw new Error("invalid base64");
  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
