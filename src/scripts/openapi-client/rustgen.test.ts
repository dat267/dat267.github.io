import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";
import { renderRsClient } from "./rustgen.ts";

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
              $ref: "#/components/schemas/User"
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

test("emits serde structs and client", () => {
  const code = renderRsClient(model);
  assert.ok(code.includes("use reqwest;"));
  assert.ok(code.includes("use serde::{Deserialize, Serialize};"));
  assert.ok(code.includes("#[derive(Serialize, Deserialize, Debug)]"));
  assert.ok(code.includes("pub struct User {"));
  assert.ok(code.includes("pub struct Api {"));
  assert.ok(code.includes("pub fn new(base_url: &str) -> Self"));
});

test("emits async typed methods", () => {
  const code = renderRsClient(model);
  assert.ok(
    code.includes(
      "pub async fn get_user(&self, id: f64, page: Option<f64>) -> Result<User, reqwest::Error>",
    ),
  );
  assert.ok(code.includes('format!("{}{}", self.base_url, "/users/{}", id)'));
  assert.ok(code.includes('.query(&[("page", page)])'));
  assert.ok(code.includes("Ok(res.json().await?)"));
});

test("emits body serialization", () => {
  const code = renderRsClient(model);
  assert.ok(
    code.includes(
      "pub async fn create_user(&self, id: f64, body: &User) -> Result<User, reqwest::Error>",
    ),
  );
  assert.ok(code.includes(".json(body)"));
});
