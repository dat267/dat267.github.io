import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generatePowerShell } from "./psgen.ts";

test("generates Invoke-RestMethod", () => {
  const req = parseCurl(
    "curl -X POST https://api.example.com/users -d '{\"a\":1}'",
  );
  const out = generatePowerShell(req);
  assert.ok(out.includes("$headers = @{"));
  assert.ok(out.includes("'Content-Type' = 'application/json'"));
  assert.ok(out.includes("$body = '{\"a\":1}'"));
  assert.ok(out.includes("Invoke-RestMethod"));
  assert.ok(out.includes("-Method Post"));
  assert.ok(out.includes("-Uri 'https://api.example.com/users'"));
});

test("single quotes are doubled", () => {
  const out = generatePowerShell(
    parseCurl("curl -d \"a='it's'\" https://api.example.com"),
  );
  assert.ok(out.includes("$body = 'a=''it''s'''"));
});
