import { strict as assert } from "node:assert";
import { test } from "node:test";
import { toYaml } from "./yaml.ts";

test("scalars and nested objects", () => {
  assert.equal(
    toYaml({ openapi: "3.0.3", info: { title: "API", version: "1.0.0" } }),
    "openapi: 3.0.3\ninfo:\n  title: API\n  version: 1.0.0\n",
  );
});

test("arrays of objects", () => {
  assert.equal(
    toYaml({ servers: [{ url: "https://x.com" }] }),
    "servers:\n  - url: https://x.com\n",
  );
});

test("empty collections inline", () => {
  assert.equal(toYaml({ a: [], b: {} }), "a: []\nb: {}\n");
});

test("quoting edge cases", () => {
  assert.equal(
    toYaml({ s: "true", n: "123", plain: "hello world" }),
    's: "true"\nn: "123"\nplain: hello world\n',
  );
});

test("nullable type arrays inline", () => {
  assert.equal(
    toYaml({ type: ["number", "null"] }),
    'type: [number, "null"]\n',
  );
});

test("path keys stay bare", () => {
  assert.equal(
    toYaml({ "/users/{id}": { get: {} } }),
    "/users/{id}:\n  get: {}\n",
  );
});
