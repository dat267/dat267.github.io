import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";

const SPEC = `openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
servers:
  - url: https://api.example.com/v1/
paths:
  /users/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
    get:
      operationId: getUser
      parameters:
        - name: page
          in: query
          schema:
            type: integer
      responses:
        200:
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        201:
          description: Created
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      required: [id]
`;

test("parses a YAML openapi spec", () => {
  const warnings: string[] = [];
  const model = parseSpec(SPEC, warnings);
  assert.equal(model.title, "Test API");
  assert.equal(model.baseUrl, "https://api.example.com/v1");
  assert.equal(model.operations.length, 2);
  const get = model.operations.find((o) => o.method === "GET")!;
  assert.equal(get.operationId, "getUser");
  assert.deepEqual(
    get.parameters.map((p) => p.name),
    ["id", "page"],
  );
  assert.equal(get.parameters[0].in, "path");
  assert.equal(get.responses[0].status, 200);
  assert.deepEqual(get.responses[0].schema, {
    $ref: "#/components/schemas/User",
  });
  const post = model.operations.find((o) => o.method === "POST")!;
  assert.equal(post.requestBody?.required, true);
  assert.equal(post.requestBody?.contentType, "application/json");
  assert.deepEqual(model.schemas.User.properties, {
    id: { type: "integer" },
    name: { type: "string" },
  });
  assert.equal(warnings.length, 0);
});

test("parses JSON input", () => {
  const doc = {
    openapi: "3.0.3",
    info: { title: "JSON API" },
    paths: { "/ping": { get: { responses: { 200: { description: "ok" } } } } },
  };
  const model = parseSpec(JSON.stringify(doc), []);
  assert.equal(model.title, "JSON API");
  assert.equal(model.operations.length, 1);
});

test("throws when paths are missing", () => {
  assert.throws(
    () => parseSpec("openapi: 3.0.3\ninfo:\n  title: X", []),
    /paths/,
  );
});

test("warns when no servers are defined", () => {
  const warnings: string[] = [];
  const model = parseSpec(
    `openapi: 3.0.3\ninfo:\n  title: X\npaths:\n  /a:\n    get:\n      responses:\n        "200":\n          description: ok`,
    warnings,
  );
  assert.equal(model.baseUrl, "");
  assert.ok(warnings.some((w) => w.includes("servers")));
});

test("ignores non-http path keys", () => {
  const model = parseSpec(
    `openapi: 3.0.3\ninfo:\n  title: X\npaths:\n  /a:\n    get:\n      responses:\n        "200":\n          description: ok\n    summary: nope`,
    [],
  );
  assert.deepEqual(
    model.operations.map((o) => o.method),
    ["GET"],
  );
});
