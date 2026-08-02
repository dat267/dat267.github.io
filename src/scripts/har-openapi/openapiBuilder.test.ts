import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildOpenApi } from "./openapiBuilder.ts";
import { groupEntries } from "./groupEntries.ts";
import type { ParsedEntry } from "./harParser.ts";

function entry(overrides: Partial<ParsedEntry>): ParsedEntry {
  return {
    origin: "https://api.example.com",
    path: "/api/users",
    method: "GET",
    query: [],
    requestHeaders: [],
    status: 200,
    hasBasicAuth: false,
    ...overrides,
  };
}

test("builds an OpenAPI 3.0.3 document", () => {
  const { groups, dominantOrigin } = groupEntries(
    [
      entry({
        path: "/api/users/1",
        query: [["q", "users"]],
        responseBody: '{"id":1}',
      }),
    ],
    [],
  );
  const doc = buildOpenApi({ groups, dominantOrigin }, { title: "Test API" });
  assert.equal(doc.openapi, "3.0.3");
  assert.deepEqual(doc.info, { title: "Test API", version: "1.0.0" });
  assert.deepEqual(doc.servers, [{ url: "https://api.example.com" }]);
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  const op = paths["/api/users/{id}"].get as Record<string, unknown>;
  assert.deepEqual(op.tags, ["api"]);
  assert.equal(op.operationId, "get_api_users_id");
  const parameters = op.parameters as Record<string, unknown>[];
  assert.deepEqual(parameters[0], {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string" },
  });
  assert.deepEqual(parameters[1], {
    name: "q",
    in: "query",
    schema: { type: "string" },
  });
  const responses = op.responses as Record<string, Record<string, unknown>>;
  assert.deepEqual(responses["200"], {
    description: "OK",
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { id: { type: "number" } },
          required: ["id"],
        },
      },
    },
  });
});

test("emits requestBody and basicAuth security", () => {
  const { groups, dominantOrigin } = groupEntries(
    [
      entry({
        path: "/api/users",
        method: "POST",
        hasBasicAuth: true,
        requestBody: '{"name":"Jane"}',
        requestContentType: "application/json",
        status: 201,
        responseBody: '{"id":1}',
      }),
    ],
    [],
  );
  const doc = buildOpenApi({ groups, dominantOrigin }, { title: "API" });
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  const op = paths["/api/users"].post as Record<string, unknown>;
  assert.deepEqual(op.requestBody, {
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    },
  });
  assert.deepEqual(op.security, [{ basicAuth: [] }]);
  assert.deepEqual(doc.components, {
    securitySchemes: { basicAuth: { type: "http", scheme: "basic" } },
  });
});
