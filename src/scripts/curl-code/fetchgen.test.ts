import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generateFetch } from "./fetchgen.ts";

test("simple GET", () => {
  const out = generateFetch(parseCurl("curl https://api.example.com/users"));
  assert.equal(out, 'fetch("https://api.example.com/users");\n');
});

test("POST JSON", () => {
  const req = parseCurl(
    'curl -X POST https://api.example.com/users -d \'{"name":"Jane"}\'',
  );
  const out = generateFetch(req);
  assert.ok(out.includes('method: "POST"'));
  assert.ok(out.includes('body: JSON.stringify({"name":"Jane"})'));
  assert.ok(out.includes('"Content-Type": "application/json"'));
});

test("POST form data", () => {
  const out = generateFetch(
    parseCurl('curl -d "name=Jane" https://api.example.com'),
  );
  assert.ok(out.includes('body: "name=Jane"'));
  assert.ok(!out.includes("JSON.stringify"));
});

test("headers and basic auth", () => {
  const out = generateFetch(
    parseCurl("curl -u user:pass -H 'X-Custom: 1' https://api.example.com"),
  );
  assert.ok(out.includes('"Authorization": "Basic'));
  assert.ok(out.includes('"X-Custom": "1"'));
});
