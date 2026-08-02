import { inferType, mergeFields, type Field } from "../json-code/ast.ts";
import { templatePath } from "./pathTemplater.ts";
import type { ParsedEntry } from "./harParser.ts";

export interface EndpointResponse {
  status: number;
  body?: Field;
  contentType?: string;
}

export interface EndpointGroup {
  origin: string;
  method: string;
  path: string;
  queryParams: Array<[string, string]>;
  requestBody?: Field;
  requestContentType?: string;
  responses: EndpointResponse[];
  hasBasicAuth: boolean;
}

export interface GroupResult {
  groups: EndpointGroup[];
  dominantOrigin: string;
}

export function groupEntries(
  entries: ParsedEntry[],
  warnings: string[],
): GroupResult {
  const byKey = new Map<string, EndpointGroup>();
  const originCounts = new Map<string, number>();
  for (const e of entries) {
    originCounts.set(e.origin, (originCounts.get(e.origin) ?? 0) + 1);
    const key = `${e.origin}|${e.method}|${templatePath(e.path)}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        origin: e.origin,
        method: e.method,
        path: templatePath(e.path),
        queryParams: [],
        responses: [],
        hasBasicAuth: false,
      };
      byKey.set(key, group);
    }
    for (const [name, value] of e.query) {
      if (!group.queryParams.some(([n]) => n === name)) {
        group.queryParams.push([name, value]);
      }
    }
    group.hasBasicAuth = group.hasBasicAuth || e.hasBasicAuth;
    if (e.requestBody !== undefined) {
      group.requestContentType = e.requestContentType;
      const value = tryParseJson(e.requestBody);
      if (value !== undefined) {
        const field = inferType(value);
        group.requestBody = group.requestBody
          ? mergeFields(group.requestBody, field)
          : field;
      } else {
        warnings.push(
          `Skipped non-JSON request body for ${e.method} ${group.path}.`,
        );
      }
    }
    const existing = group.responses.find((r) => r.status === e.status);
    if (e.responseBody !== undefined) {
      const value = tryParseJson(e.responseBody);
      if (value !== undefined) {
        const field = inferType(value);
        if (existing) {
          existing.body = existing.body
            ? mergeFields(existing.body, field)
            : field;
          existing.contentType = e.responseContentType;
        } else {
          group.responses.push({
            status: e.status,
            body: field,
            contentType: e.responseContentType,
          });
        }
      } else {
        warnings.push(
          `Skipped non-JSON response body for ${e.method} ${group.path} (${e.status}).`,
        );
        if (!existing) group.responses.push({ status: e.status });
      }
    } else if (!existing) {
      group.responses.push({ status: e.status });
    }
  }
  const dominantOrigin =
    [...originCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  if (originCounts.size > 1) {
    warnings.push(
      `Multiple origins detected; using ${dominantOrigin} for the servers list.`,
    );
  }
  return { groups: [...byKey.values()], dominantOrigin };
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
