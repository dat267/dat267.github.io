import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generateRust } from "./rustgen.ts";

test("custom method uses Method::from_bytes", () => {
  const req = parseCurl(
    'curl -X PURGE https://api.example.com/x -H "X-Custom: 1" -d \'{"a":1}\'',
  );
  const out = generateRust(req);
  assert.ok(out.includes("let client = reqwest::Client::new();"));
  assert.ok(out.includes('.method(reqwest::Method::from_bytes(b"PURGE")?)'));
  assert.ok(out.includes('.url("https://api.example.com/x")'));
  assert.ok(out.includes('.header("X-Custom", "1")'));
  assert.ok(out.includes('.body(r#{"a":1}#)'));
  assert.ok(out.includes(".send()"));
  assert.ok(out.includes(".await?;"));
});

test("GET uses fetch-style helper", () => {
  const out = generateRust(parseCurl("curl https://api.example.com"));
  assert.ok(out.includes('.get("https://api.example.com")'));
});

test("raw string delimiter is bumped when the body contains quote-hash", () => {
  const req = parseCurl(
    'curl -X POST https://api.example.com/x -d \'{"a":"#"}\'',
  );
  const out = generateRust(req);
  assert.ok(out.includes('.body(r##{"a":"#"}##)'));
  assert.ok(!out.includes('.body(r#{"a":"#"}#)'));
});

test("common body keeps a single-hash raw string delimiter", () => {
  const out = generateRust(
    parseCurl('curl -X POST https://api.example.com/x -d \'{"a":"b#"}\''),
  );
  assert.ok(out.includes('.body(r#{"a":"b#"}#)'));
});
