import type { EndpointGroup, GroupResult } from "./groupEntries.ts";
import { pathParams } from "./pathTemplater.ts";
import { schemaFromField } from "./schema.ts";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export function buildOpenApi(
  result: GroupResult,
  meta: { title: string },
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const group of result.groups) {
    const method = group.method.toLowerCase();
    paths[group.path] = {
      ...(paths[group.path] ?? {}),
      [method]: buildOperation(group),
    };
  }
  const hasAuth = result.groups.some((g) => g.hasBasicAuth);
  return {
    openapi: "3.0.3",
    info: { title: meta.title || "API", version: "1.0.0" },
    servers: [{ url: result.dominantOrigin }],
    paths,
    components: hasAuth
      ? { securitySchemes: { basicAuth: { type: "http", scheme: "basic" } } }
      : {},
  };
}

function buildOperation(group: EndpointGroup): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [];
  for (const name of pathParams(group.path)) {
    parameters.push({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }
  for (const [name, value] of group.queryParams) {
    parameters.push({ name, in: "query", schema: querySchema(value) });
  }
  const op: Record<string, unknown> = {
    tags: [group.path.split("/").filter(Boolean)[0] ?? "default"],
    operationId: operationId(group),
  };
  if (parameters.length) op.parameters = parameters;
  if (group.requestBody !== undefined) {
    op.requestBody = {
      content: {
        [group.requestContentType ?? "application/json"]: {
          schema: schemaFromField(group.requestBody),
        },
      },
    };
  }
  const responses: Record<string, unknown> = {};
  for (const r of group.responses) {
    const resp: Record<string, unknown> = {
      description: STATUS_TEXT[r.status] ?? `HTTP ${r.status}`,
    };
    if (r.body !== undefined) {
      resp.content = {
        [r.contentType ?? "application/json"]: {
          schema: schemaFromField(r.body),
        },
      };
    }
    responses[String(r.status)] = resp;
  }
  op.responses = responses;
  if (group.hasBasicAuth) op.security = [{ basicAuth: [] }];
  return op;
}

function operationId(group: EndpointGroup): string {
  const name = group.path
    .split("/")
    .filter(Boolean)
    .map((seg) => (seg.startsWith("{") ? "id" : seg))
    .join("_");
  return `${group.method.toLowerCase()}_${name}`;
}

function querySchema(value: string): Record<string, unknown> {
  if (/^\d+$/.test(value)) return { type: "integer" };
  if (/^-?\d+\.\d+$/.test(value)) return { type: "number" };
  if (value === "true" || value === "false") return { type: "boolean" };
  return { type: "string" };
}
