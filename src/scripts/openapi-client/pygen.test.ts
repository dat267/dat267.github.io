import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";
import { renderPyClient } from "./pygen.ts";

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

test("emits dataclasses and client", () => {
  const code = renderPyClient(model);
  assert.ok(code.includes("from dataclasses import dataclass, asdict"));
  assert.ok(code.includes("import requests"));
  assert.ok(code.includes("@dataclass"));
  assert.ok(code.includes("class User:"));
  assert.ok(code.includes("class Api:"));
});

test("emits snake_case typed methods", () => {
  const code = renderPyClient(model);
  assert.ok(
    code.includes(
      "def get_user(self, id: float, page: Optional[float] = None) -> User:",
    ),
  );
  assert.ok(
    code.includes(
      'response = requests.get(f"{self.base_url}/users/{id}", params=params)',
    ),
  );
  assert.ok(code.includes("return User(**response.json())"));
});

test("emits body serialization with asdict", () => {
  const code = renderPyClient(model);
  assert.ok(
    code.includes("def create_user(self, id: float, body: User) -> User:"),
  );
  assert.ok(
    code.includes(
      'payload = asdict(body) if hasattr(body, "__dataclass_fields__") else body',
    ),
  );
  assert.ok(code.includes("json=payload"));
});
