import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";

const SPEC = `openapi: 3.0.3
info:
  title: Test API
servers:
  - url: https://api.example.com
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
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
              required: [name]
      responses:
        201:
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
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

test("registers component schemas and names operations", () => {
  const model = buildClientModel(parseSpec(SPEC, []), []);
  assert.ok(model.types.some((t) => t.name === "User"));
  const get = model.operations.find((o) => o.name === "getUser")!;
  assert.equal(get.method, "GET");
  assert.deepEqual(
    get.pathParams.map((p) => p.name),
    ["id"],
  );
  assert.equal(get.pathParams[0].field.type.kind, "number");
  assert.deepEqual(
    get.queryParams.map((p) => p.name),
    ["page"],
  );
  assert.equal(get.success?.status, 200);
  assert.equal(get.success?.name, "User");
});

test("names inline request body and response types from operation", () => {
  const model = buildClientModel(parseSpec(SPEC, []), []);
  const post = model.operations.find((o) => o.name === "createUser")!;
  assert.equal(post.body?.name, "CreateUserRequest");
  assert.equal(post.body?.required, true);
  const created = post.responses.find((r) => r.status === 201)!;
  assert.equal(created.name, "CreateUserResponse201");
});

test("dedupes colliding nested type names", () => {
  const spec = `openapi: 3.0.3
info:
  title: T
paths: {}
components:
  schemas:
    A:
      type: object
      properties:
        meta:
          type: object
          properties:
            x:
              type: string
    B:
      type: object
      properties:
        meta:
          type: object
          properties:
            y:
              type: string
`;
  const model = buildClientModel(parseSpec(spec, []), []);
  const names = model.types.map((t) => t.name);
  assert.ok(names.includes("Meta"));
  assert.ok(names.includes("Meta1"));
});

test("warns when security schemes are present", () => {
  const spec = `openapi: 3.0.3
info:
  title: T
paths:
  /a:
    get:
      responses:
        "200":
          description: ok
components:
  securitySchemes:
    basicAuth:
      type: http
      scheme: basic
`;
  const warnings: string[] = [];
  buildClientModel(parseSpec(spec, warnings), warnings);
  assert.ok(
    warnings.some(
      (w) =>
        w.toLowerCase().includes("security") ||
        w.toLowerCase().includes("auth"),
    ),
  );
});

test("operation name falls back to method + path", () => {
  const spec = `openapi: 3.0.3
info:
  title: T
paths:
  /users/{id}/posts:
    get:
      responses:
        "200":
          description: ok
`;
  const model = buildClientModel(parseSpec(spec, []), []);
  assert.equal(model.operations[0].name, "getUsersIdPosts");
});
