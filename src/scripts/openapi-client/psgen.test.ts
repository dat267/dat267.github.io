import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";
import { renderPsClient } from "./psgen.ts";

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

test("emits verb-noun functions", () => {
  const code = renderPsClient(model);
  assert.ok(code.includes("function Get-User {"));
  assert.ok(code.includes("function New-User {"));
  assert.ok(code.includes("Invoke-RestMethod"));
});

test("emits parameters and base url", () => {
  const code = renderPsClient(model);
  assert.ok(code.includes("[Parameter(Mandatory)]"));
  assert.ok(code.includes("[double]$Id"));
  assert.ok(code.includes("[double]$Page"));
  assert.ok(code.includes("[string]$BaseUrl = 'https://api.example.com'"));
});

test("emits query dict and body json", () => {
  const code = renderPsClient(model);
  assert.ok(code.includes("$params = @{}"));
  assert.ok(code.includes('$uri = "$BaseUrl/users/$Id"'));
  assert.ok(code.includes("-Body ($Body | ConvertTo-Json)"));
});
