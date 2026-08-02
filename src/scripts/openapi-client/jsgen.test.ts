import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";
import { renderJsClient } from "./jsgen.ts";

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
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
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
      responses:
        201:
          description: Created
`;

const model = buildClientModel(parseSpec(SPEC, []), []);

test("emits a class with untyped methods", () => {
  const code = renderJsClient(model);
  assert.ok(code.includes("export class Api {"));
  assert.ok(code.includes("async getUser(id, page) {"));
  assert.ok(code.includes("async createUser(id, body) {"));
  assert.ok(!code.includes("export interface"));
  assert.ok(!code.includes(": number"));
});

test("emits fetch calls with query and body", () => {
  const code = renderJsClient(model);
  assert.ok(code.includes("URLSearchParams"));
  assert.ok(code.includes("body: JSON.stringify(body)"));
  assert.ok(code.includes('method: "POST"'));
  assert.ok(code.includes("`${this.baseUrl}/users/${id}`"));
});
