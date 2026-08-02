import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";
import { renderTsClient } from "./tsgen.ts";

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
    delete:
      operationId: deleteUser
      responses:
        204:
          description: Deleted
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
                $ref: "#/components/schemas/User"
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

const model = buildClientModel(parseSpec(SPEC, []), []);

test("emits model interfaces", () => {
  const code = renderTsClient(model);
  assert.ok(code.includes("export interface User {"));
  assert.ok(code.includes("  id: number;"));
  assert.ok(code.includes("  name?: string;"));
});

test("emits a typed client class", () => {
  const code = renderTsClient(model);
  assert.ok(code.includes("export class Api {"));
  assert.ok(code.includes('constructor(baseUrl = "https://api.example.com")'));
  assert.ok(
    code.includes("async getUser(id: number, page?: number): Promise<User>"),
  );
});

test("emits path templating and query params", () => {
  const code = renderTsClient(model);
  assert.ok(code.includes("`${this.baseUrl}/users/${id}`"));
  assert.ok(code.includes("URLSearchParams"));
  assert.ok(code.includes('query.set("page", String(page))'));
});

test("emits request body handling", () => {
  const code = renderTsClient(model);
  assert.ok(
    code.includes(
      "async createUser(id: number, body: CreateUserRequest): Promise<User>",
    ),
  );
  assert.ok(code.includes("body: JSON.stringify(body)"));
  assert.ok(code.includes('"Content-Type": "application/json"'));
});

test("emits void methods for bodyless responses", () => {
  const code = renderTsClient(model);
  assert.ok(code.includes("async deleteUser(id: number): Promise<void>"));
  assert.ok(code.includes('method: "DELETE"'));
});
