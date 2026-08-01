import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generatePython } from "./pygen.ts";

test("generates requests.request with JSON body", () => {
  const req = parseCurl(
    'curl -X POST https://api.example.com/users -d \'{"active":true,"n":null}\'',
  );
  const out = generatePython(req);
  assert.ok(out.includes("import requests"));
  assert.ok(out.includes('method="POST"'));
  assert.ok(out.includes('url="https://api.example.com/users"'));
  assert.ok(out.includes("headers=headers,"));
  assert.ok(out.includes('json={"active": True, "n": None},'));
});

test("form body uses data=", () => {
  const out = generatePython(
    parseCurl("curl -d 'name=Jane' https://api.example.com"),
  );
  assert.ok(out.includes('data="name=Jane",'));
  assert.ok(!out.includes("json="));
});

test("GET without body has no body kwarg", () => {
  const out = generatePython(parseCurl("curl https://api.example.com"));
  assert.ok(!out.includes("json=") && !out.includes("data="));
});

test("JSON-looking invalid body falls back to data= with a warning", () => {
  const req = parseCurl("curl -X POST https://api.example.com -d '{oops'");
  const out = generatePython(req);
  assert.ok(out.includes('data="{oops",'));
  assert.ok(!out.includes("json="));
  assert.ok(req.warnings.some((w) => w.includes("could not be parsed")));
});
