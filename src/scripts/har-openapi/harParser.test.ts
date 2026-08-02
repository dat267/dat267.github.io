import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseHar } from "./harParser.ts";

function har(entries: unknown[]): unknown {
  return { log: { entries } };
}

test("parses a basic entry", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users?page=2",
          headers: [{ name: "X-A", value: "1" }],
        },
        response: {
          status: 200,
          content: { mimeType: "application/json", text: '{"id":1}' },
        },
      },
    ]),
    warnings,
  );
  assert.equal(parsed.length, 1);
  const e = parsed[0];
  assert.equal(e.method, "GET");
  assert.equal(e.origin, "https://api.example.com");
  assert.equal(e.path, "/users");
  assert.deepEqual(e.query, [["page", "2"]]);
  assert.deepEqual(e.requestHeaders, [["X-A", "1"]]);
  assert.equal(e.status, 200);
  assert.equal(e.responseBody, '{"id":1}');
  assert.equal(e.responseContentType, "application/json");
  assert.equal(warnings.length, 0);
});

test("extracts postData and basic auth flag", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: {
          method: "POST",
          url: "https://api.example.com/users",
          headers: [{ name: "Authorization", value: "Basic dXNlcjpwYXNz" }],
          postData: { mimeType: "application/json", text: '{"name":"Jane"}' },
        },
        response: {
          status: 201,
          content: { mimeType: "application/json", text: "{}" },
        },
      },
    ]),
    warnings,
  );
  const e = parsed[0];
  assert.equal(e.requestBody, '{"name":"Jane"}');
  assert.equal(e.requestContentType, "application/json");
  assert.equal(e.hasBasicAuth, true);
  assert.equal(e.status, 201);
});

test("decodes base64 response bodies as utf-8", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: { method: "GET", url: "https://api.example.com/x" },
        response: {
          status: 200,
          content: { encoding: "base64", text: btoa('{"ok":true}') },
        },
      },
    ]),
    warnings,
  );
  assert.equal(parsed[0].responseBody, '{"ok":true}');
});

test("skips unparseable base64 with a warning", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: { method: "GET", url: "https://api.example.com/x" },
        response: {
          status: 200,
          content: { encoding: "base64", text: "@@@notbase64" },
        },
      },
    ]),
    warnings,
  );
  assert.equal(parsed[0].responseBody, undefined);
  assert.ok(warnings.some((w) => w.includes("base64")));
});

test("invalid HAR structure throws", () => {
  assert.throws(() => parseHar({}, []), /log.entries/);
});

test("skips entries with bad URLs and warns", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: { method: "GET", url: "not a url" },
        response: { status: 200 },
      },
      {
        request: { method: "GET", url: "https://ok.example.com/" },
        response: { status: 200 },
      },
    ]),
    warnings,
  );
  assert.equal(parsed.length, 1);
  assert.equal(warnings.length, 1);
});
