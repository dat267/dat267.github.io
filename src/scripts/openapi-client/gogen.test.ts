import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseSpec } from "./specParser.ts";
import { buildClientModel } from "./clientModel.ts";
import { renderGoClient } from "./gogen.ts";

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

test("emits model structs and client", () => {
  const code = renderGoClient(model);
  assert.ok(code.includes("type User struct {"));
  assert.ok(code.includes('Id float64 `json:"id"`'));
  assert.ok(code.includes("type Client struct {"));
  assert.ok(code.includes("func NewClient(baseURL string) *Client {"));
});

test("emits typed methods with path and query params", () => {
  const code = renderGoClient(model);
  assert.ok(
    code.includes(
      "func (c *Client) GetUser(id float64, page *float64) (*User, error) {",
    ),
  );
  assert.ok(
    code.includes(
      'http.NewRequest("GET", c.BaseURL + "/users" + fmt.Sprint(id), nil)',
    ),
  );
  assert.ok(code.includes('q.Set("page", fmt.Sprintf("%v", *page))'));
  assert.ok(code.includes("json.NewDecoder(resp.Body).Decode(&out)"));
});

test("emits body serialization", () => {
  const code = renderGoClient(model);
  assert.ok(
    code.includes(
      "func (c *Client) CreateUser(id float64, body User) (*User, error) {",
    ),
  );
  assert.ok(code.includes("jsonBytes, err := json.Marshal(body)"));
  assert.ok(code.includes("bytes.NewReader(jsonBytes)"));
  assert.ok(code.includes('"bytes"'));
});
