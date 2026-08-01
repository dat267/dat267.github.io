import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isJsonBody, parseCurl } from "./parser.ts";

test("simple GET", () => {
  const req = parseCurl("curl https://api.example.com/users");
  assert.equal(req.method, "GET");
  assert.equal(req.url, "https://api.example.com/users");
  assert.equal(req.headers.length, 0);
  assert.equal(req.body, undefined);
});

test("POST with JSON body infers content type", () => {
  const req = parseCurl(
    'curl -X POST https://api.example.com/users -H "X-Custom: 1" -d \'{"name":"Jane"}\'',
  );
  assert.equal(req.method, "POST");
  assert.deepEqual(req.headers, [
    ["X-Custom", "1"],
    ["Content-Type", "application/json"],
  ]);
  assert.equal(req.body, '{"name":"Jane"}');
  assert.ok(isJsonBody(req));
});

test("form body gets form content type", () => {
  const req = parseCurl(
    'curl -d "name=Jane&age=30" https://api.example.com/users',
  );
  assert.equal(req.method, "POST");
  assert.deepEqual(req.headers, [
    ["Content-Type", "application/x-www-form-urlencoded"],
  ]);
  assert.ok(!isJsonBody(req));
});

test("explicit content-type header is not overridden", () => {
  const req = parseCurl(
    'curl -d \'{"a":1}\' -H "Content-Type: application/vnd.api+json" https://x.com',
  );
  assert.deepEqual(req.headers, [["Content-Type", "application/vnd.api+json"]]);
});

test("basic auth via -u", () => {
  const req = parseCurl("curl -u user:pass https://api.example.com");
  const auth = req.headers.find(([k]) => k === "Authorization");
  assert.ok(auth);
  assert.equal(auth[1], "Basic " + btoa("user:pass"));
});

test("data-raw and long flags", () => {
  const req = parseCurl(
    'curl --request POST --data-raw "hello" https://api.example.com',
  );
  assert.equal(req.method, "POST");
  assert.equal(req.body, "hello");
});

test("quotes are stripped", () => {
  const req = parseCurl(
    `curl "https://api.example.com/x" -H "Authorization: Bearer abc"`,
  );
  assert.equal(req.url, "https://api.example.com/x");
  assert.deepEqual(req.headers, [["Authorization", "Bearer abc"]]);
});

test("unsupported -F produces a warning", () => {
  const req = parseCurl('curl -F "file=@a.txt" https://api.example.com/upload');
  assert.ok(req.warnings.some((w) => w.includes("-F")));
});

test("data referencing a file warns", () => {
  const req = parseCurl("curl -d @data.json https://api.example.com");
  assert.ok(req.warnings.some((w) => w.includes("@")));
});

test("empty quoted -d body is preserved", () => {
  const req = parseCurl('curl -d "" https://api.example.com/x');
  assert.equal(req.method, "POST");
  assert.equal(req.body, "");
  assert.equal(req.url, "https://api.example.com/x");
  assert.deepEqual(req.headers, [
    ["Content-Type", "application/x-www-form-urlencoded"],
  ]);
});

test("empty quoted -H does not swallow the URL", () => {
  const req = parseCurl('curl -H "" https://api.example.com/x');
  assert.equal(req.url, "https://api.example.com/x");
  assert.ok(req.warnings.some((w) => w.includes("malformed header")));
});

test("non-ASCII -u yields a warning and no auth header", () => {
  const req = parseCurl("curl -u 用户:päss https://api.example.com");
  assert.ok(req.warnings.some((w) => w.includes("skipped -u")));
  assert.ok(!req.headers.some(([k]) => k === "Authorization"));
});

test("no URL throws", () => {
  assert.throws(() => parseCurl("curl -X GET"));
});
