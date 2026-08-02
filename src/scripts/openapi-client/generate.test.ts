import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateClient } from "./generate.ts";

const SPEC = `openapi: 3.0.3
info:
  title: Petstore
servers:
  - url: https://petstore.example.com
paths:
  /pets:
    get:
      operationId: listPets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        200:
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Pet"
    post:
      operationId: createPet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        201:
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      required: [id, name]
`;

test("typescript", () => {
  const { code, warnings } = generateClient(SPEC, "typescript");
  assert.ok(code.includes("export interface Pet {"));
  assert.ok(code.includes("async listPets(limit?: number): Promise<Pet[]>"));
  assert.equal(warnings.length, 0);
});

test("javascript", () => {
  const { code } = generateClient(SPEC, "javascript");
  assert.ok(code.includes("async listPets(limit)"));
  assert.ok(!code.includes("export interface"));
});

test("go", () => {
  const { code } = generateClient(SPEC, "go");
  assert.ok(
    code.includes("func (c *Client) ListPets(limit *float64) ([]Pet, error) {"),
  );
  assert.ok(code.includes("type Pet struct {"));
});

test("python", () => {
  const { code } = generateClient(SPEC, "python");
  assert.ok(
    code.includes(
      "def list_pets(self, limit: Optional[float] = None) -> list[Pet]:",
    ),
  );
  assert.ok(code.includes("class Pet:"));
});

test("rust", () => {
  const { code } = generateClient(SPEC, "rust");
  assert.ok(
    code.includes(
      "pub async fn list_pets(&self, limit: Option<f64>) -> Result<Vec<Pet>, reqwest::Error>",
    ),
  );
  assert.ok(code.includes("pub struct Pet {"));
});

test("powershell", () => {
  const { code } = generateClient(SPEC, "powershell");
  assert.ok(code.includes("function Get-Pets {"));
  assert.ok(code.includes("function New-Pet {"));
});

test("rejects invalid specs", () => {
  assert.throws(
    () => generateClient("not a spec at all", "typescript"),
    /paths/,
  );
});
