import { parseYaml } from "./yamlParser.ts";

export type JsonSchema = Record<string, unknown>;

export interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: JsonSchema;
}

export interface OpenApiRequestBody {
  required?: boolean;
  contentType?: string;
  schema?: JsonSchema;
}

export interface OpenApiResponse {
  status: number;
  contentType?: string;
  schema?: JsonSchema;
}

export interface OpenApiOperation {
  method: string;
  path: string;
  operationId?: string;
  parameters: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: OpenApiResponse[];
}

export interface OpenApiModel {
  title: string;
  baseUrl: string;
  schemas: Record<string, JsonSchema>;
  operations: OpenApiOperation[];
  hasSecurity: boolean;
}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

export function parseSpec(text: string, warnings: string[]): OpenApiModel {
  const trimmed = text.trim();
  if (trimmed === "") throw new Error("Empty input: expected an OpenAPI spec.");
  let doc: unknown;
  try {
    doc = trimmed.startsWith("{") ? JSON.parse(trimmed) : parseYaml(text);
  } catch (err) {
    throw new Error(
      "Invalid spec: " + (err instanceof Error ? err.message : String(err)),
    );
  }
  if (typeof doc !== "object" || doc === null) {
    throw new Error("Invalid spec: expected an object.");
  }
  const root = doc as Record<string, unknown>;
  const version = root.openapi;
  if (typeof version !== "string" || !version.startsWith("3.")) {
    warnings.push(
      "Spec does not declare OpenAPI 3.x; attempting to parse anyway.",
    );
  }
  const paths = root.paths;
  if (typeof paths !== "object" || paths === null || Array.isArray(paths)) {
    throw new Error("Invalid OpenAPI spec: expected paths to be an object.");
  }
  const info = (root.info ?? {}) as Record<string, unknown>;
  const title = typeof info.title === "string" ? info.title : "API";
  const servers = Array.isArray(root.servers) ? root.servers : [];
  const server = servers[0] as Record<string, unknown> | undefined;
  let baseUrl = typeof server?.url === "string" ? server.url : "";
  if (baseUrl !== "") {
    if (/\{/.test(baseUrl)) {
      warnings.push(
        `Server URL contains variables (${baseUrl}); they are left empty.`,
      );
      baseUrl = baseUrl.replace(/\{[^}]*\}/g, "");
    }
    baseUrl = baseUrl.replace(/\/+$/, "");
  } else {
    warnings.push("No servers defined; the generated base URL will be empty.");
  }
  const components = (root.components ?? {}) as Record<string, unknown>;
  const schemas = (components.schemas ?? {}) as Record<string, JsonSchema>;
  const securitySchemes = (components.securitySchemes ?? {}) as Record<
    string,
    unknown
  >;
  const hasSecurity = Object.keys(securitySchemes).length > 0;
  const operations: OpenApiOperation[] = [];
  for (const [path, pathItem] of Object.entries(
    paths as Record<string, unknown>,
  )) {
    if (typeof pathItem !== "object" || pathItem === null) continue;
    const item = pathItem as Record<string, unknown>;
    const pathParams = Array.isArray(item.parameters)
      ? (item.parameters as JsonSchema[])
      : [];
    for (const method of METHODS) {
      const op = item[method];
      if (typeof op !== "object" || op === null) continue;
      operations.push(
        buildOperation(
          method,
          path,
          op as Record<string, unknown>,
          pathParams,
          warnings,
        ),
      );
    }
  }
  return { title, baseUrl, schemas, operations, hasSecurity };
}

function buildOperation(
  method: string,
  path: string,
  op: Record<string, unknown>,
  pathParams: JsonSchema[],
  warnings: string[],
): OpenApiOperation {
  const params = mergeParams(
    pathParams,
    Array.isArray(op.parameters) ? (op.parameters as JsonSchema[]) : [],
  );
  const requestBody = buildRequestBody(
    op.requestBody as JsonSchema | undefined,
    warnings,
  );
  const responses = buildResponses(
    (op.responses ?? {}) as Record<string, unknown>,
    warnings,
  );
  return {
    method: method.toUpperCase(),
    path,
    ...(typeof op.operationId === "string"
      ? { operationId: op.operationId }
      : {}),
    parameters: params,
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
}

function mergeParams(
  pathLevel: JsonSchema[],
  opLevel: JsonSchema[],
): OpenApiParameter[] {
  const out = [...pathLevel, ...opLevel].map((p) => ({
    name: typeof p.name === "string" ? p.name : "",
    in: typeof p.in === "string" ? p.in : "",
    ...(p.required !== undefined ? { required: p.required === true } : {}),
    ...(p.schema ? { schema: p.schema as JsonSchema } : {}),
  }));
  return out.filter((p) => p.name !== "");
}

function buildRequestBody(
  body: JsonSchema | undefined,
  warnings: string[],
): OpenApiRequestBody | undefined {
  if (!body) return undefined;
  const content = (body.content ?? {}) as Record<string, unknown>;
  const entries = Object.entries(content);
  if (entries.length === 0) return undefined;
  const [contentType, media] = entries[0];
  const schema = (media as Record<string, unknown>)?.schema as
    JsonSchema | undefined;
  if (schema && !hasSchema(schema)) {
    warnings.push(
      `Skipping request body schema for ${contentType} (binary or empty).`,
    );
  }
  return {
    ...(body.required !== undefined
      ? { required: body.required === true }
      : {}),
    contentType,
    ...(schema && hasSchema(schema) ? { schema } : {}),
  };
}

function buildResponses(
  responses: Record<string, unknown>,
  warnings: string[],
): OpenApiResponse[] {
  const out: OpenApiResponse[] = [];
  for (const [key, value] of Object.entries(responses)) {
    const status = key === "default" ? 0 : Number.parseInt(key, 10);
    if (Number.isNaN(status)) continue;
    const resp = (
      typeof value === "object" && value !== null ? value : {}
    ) as Record<string, unknown>;
    const content = (resp.content ?? {}) as Record<string, unknown>;
    const entries = Object.entries(content);
    let contentType: string | undefined;
    let schema: JsonSchema | undefined;
    if (entries.length > 0) {
      const [ct, media] = entries[0];
      contentType = ct;
      const s = (media as Record<string, unknown>)?.schema as
        JsonSchema | undefined;
      if (s && hasSchema(s)) schema = s;
    }
    out.push({
      status,
      ...(contentType ? { contentType } : {}),
      ...(schema ? { schema } : {}),
    });
  }
  out.sort((a, b) => a.status - b.status);
  return out;
}

function hasSchema(schema: JsonSchema): boolean {
  return Object.keys(schema).length > 0;
}
