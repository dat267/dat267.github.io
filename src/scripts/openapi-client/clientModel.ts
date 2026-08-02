import type { Field } from "../json-code/ast.ts";
import { pascalCase } from "../json-code/names.ts";
import { pathParams } from "../har-openapi/pathTemplater.ts";
import { schemaToField } from "./schemaToField.ts";
import type {
  OpenApiModel,
  OpenApiOperation,
  OpenApiParameter,
} from "./specParser.ts";

export interface ClientType {
  name: string;
  fields: Map<string, Field>;
}

export interface ClientParam {
  name: string;
  field: Field;
  required: boolean;
}

export interface ClientBody {
  name?: string;
  field: Field;
  required: boolean;
  contentType: string;
}

export interface ClientResponse {
  status: number;
  name?: string;
  field?: Field;
  contentType: string;
}

export interface ClientOperation {
  name: string;
  method: string;
  path: string;
  pathParams: ClientParam[];
  queryParams: ClientParam[];
  body?: ClientBody;
  responses: ClientResponse[];
  success?: ClientResponse;
}

export interface ClientModel {
  title: string;
  baseUrl: string;
  types: ClientType[];
  operations: ClientOperation[];
}

export function buildClientModel(
  spec: OpenApiModel,
  warnings: string[],
): ClientModel {
  const types = new Map<string, Field>();
  const used = new Set<string>();

  if (spec.hasSecurity) {
    warnings.push(
      "Security schemes are present; generated clients do not implement authentication.",
    );
  }

  for (const [name, schema] of Object.entries(spec.schemas)) {
    const field = schemaToField(schema, resolveRef(spec.schemas));
    collectTypes(field, name, used, types);
  }

  const usedOps = new Set<string>();
  const operations: ClientOperation[] = [];
  for (const op of spec.operations) {
    let name = operationName(op);
    if (usedOps.has(name)) {
      let n = 1;
      while (usedOps.has(`${name}${n}`)) n++;
      name = `${name}${n}`;
      warnings.push(`Duplicate operation name; renamed to ${name}.`);
    }
    usedOps.add(name);
    operations.push(buildOperation(op, name, types, used, spec.schemas));
  }

  return {
    title: spec.title,
    baseUrl: spec.baseUrl,
    types: [...types.entries()].map(([name, fields]) => ({ name, fields })),
    operations,
  };
}

function buildOperation(
  op: OpenApiOperation,
  name: string,
  types: Map<string, Field>,
  used: Set<string>,
  schemas: Record<string, unknown>,
): ClientOperation {
  const templated = pathParams(op.path);
  const declaredPath = op.parameters.filter((p) => p.in === "path");
  const pathParamList: ClientParam[] = templated.map((pn) => {
    const declared = declaredPath.find((p) => p.name === pn);
    return {
      name: pn,
      field: declared?.schema
        ? schemaToField(declared.schema, resolveRef(schemas))
        : stringField(),
      required: true,
    };
  });
  const queryParams: ClientParam[] = op.parameters
    .filter((p) => p.in === "query")
    .map((p) => ({
      name: p.name,
      field: p.schema
        ? schemaToField(p.schema, resolveRef(schemas))
        : stringField(),
      required: p.required === true,
    }));

  const responses: ClientResponse[] = op.responses.map((r) => {
    if (!r.schema)
      return {
        status: r.status,
        contentType: r.contentType ?? "application/json",
      };
    const field = schemaToField(r.schema, resolveRef(schemas));
    collectTypes(field, `${pascalCase(name)}Response${r.status}`, used, types);
    return {
      status: r.status,
      name: rootTypeName(field),
      field,
      contentType: r.contentType ?? "application/json",
    };
  });

  let body: ClientBody | undefined;
  if (op.requestBody?.schema) {
    const field = schemaToField(op.requestBody.schema, resolveRef(schemas));
    collectTypes(field, `${pascalCase(name)}Request`, used, types);
    body = {
      name: rootTypeName(field),
      field,
      required: op.requestBody.required === true,
      contentType: op.requestBody.contentType ?? "application/json",
    };
  }

  const success = responses.find((r) => r.status >= 200 && r.status < 300);
  return {
    name,
    method: op.method,
    path: op.path,
    pathParams: pathParamList,
    queryParams,
    ...(body ? { body } : {}),
    responses,
    ...(success ? { success } : {}),
  };
}

function rootTypeName(field: Field): string | undefined {
  const t = field.type;
  if (t.kind === "object") return t.name;
  if (t.kind === "array" && t.items.type.kind === "object")
    return t.items.type.name;
  return undefined;
}

export function collectTypes(
  root: Field,
  rootName: string,
  used: Set<string>,
  types: Map<string, Field>,
): void {
  const walk = (field: Field, suggested: string): void => {
    const t = field.type;
    if (t.kind === "array") {
      walk(t.items, suggested);
      return;
    }
    if (t.kind !== "object") return;
    if (t.name) return;
    let name = suggested;
    if (used.has(name)) {
      let n = 1;
      while (used.has(`${name}${n}`)) n++;
      name = `${name}${n}`;
    }
    used.add(name);
    t.name = name;
    types.set(name, t.fields);
    for (const [key, f] of t.fields) walk(f, pascalCase(key));
  };
  walk(root, rootName);
}

function operationName(op: OpenApiOperation): string {
  if (op.operationId) {
    const c = camelCase(op.operationId);
    if (c) return c;
  }
  const segments = op.path
    .split("/")
    .filter(Boolean)
    .map((s) => (s.startsWith("{") ? s.slice(1, -1) : s));
  return (
    camelCase([op.method.toLowerCase(), ...segments].join(" ")) || "operation"
  );
}

function camelCase(s: string): string {
  const words = s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0];
  return (
    first[0].toLowerCase() +
    first.slice(1) +
    words
      .slice(1)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join("")
  );
}

function stringField(): Field {
  return { type: { kind: "string" }, nullable: false, required: true };
}

function resolveRef(schemas: Record<string, unknown>) {
  return (ref: string): Record<string, unknown> | undefined => {
    const name = ref.split("/").pop();
    if (!name) return undefined;
    const s = schemas[name];
    return typeof s === "object" && s !== null
      ? (s as Record<string, unknown>)
      : undefined;
  };
}
