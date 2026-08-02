import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateOpenApi } from "./generate.ts";

const HAR = JSON.stringify({
  log: {
    creator: { name: "Chrome DevTools" },
    entries: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users?page=1",
          headers: [{ name: "Authorization", value: "Basic dXNlcjpwYXNz" }],
        },
        response: {
          status: 200,
          content: {
            mimeType: "application/json",
            text: '{"id":1,"name":"Jane"}',
          },
        },
      },
      {
        request: {
          method: "POST",
          url: "https://api.example.com/users",
          headers: [],
          postData: { mimeType: "application/json", text: '{"name":"Bob"}' },
        },
        response: {
          status: 201,
          content: { mimeType: "application/json", text: '{"id":2}' },
        },
      },
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users/123",
          headers: [],
        },
        response: {
          status: 200,
          content: {
            mimeType: "application/json",
            text: '{"id":123,"name":"Nested"}',
          },
        },
      },
    ],
  },
});

test("generates a YAML OpenAPI 3.0.3 spec", () => {
  const { spec, warnings } = generateOpenApi(HAR);
  assert.ok(spec.includes("openapi: 3.0.3"));
  assert.ok(spec.includes("title: Chrome DevTools"));
  assert.ok(spec.includes("paths:"));
  assert.ok(spec.includes("/users:"));
  assert.ok(spec.includes("/users/{id}:"));
  assert.ok(spec.includes("basicAuth:"));
  assert.equal(warnings.length, 0);
});

test("rejects invalid HAR structure", () => {
  assert.throws(() => generateOpenApi('{"log":{}}'), /log.entries/);
});

test("rejects invalid JSON", () => {
  assert.throws(() => generateOpenApi("{nope"), /Invalid JSON/);
});
