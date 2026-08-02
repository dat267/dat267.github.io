import { strict as assert } from "node:assert";
import { test } from "node:test";
import { groupEntries } from "./groupEntries.ts";
import type { ParsedEntry } from "./harParser.ts";

function entry(overrides: Partial<ParsedEntry>): ParsedEntry {
  return {
    origin: "https://api.example.com",
    path: "/api/users",
    method: "GET",
    query: [],
    requestHeaders: [],
    status: 200,
    hasBasicAuth: false,
    ...overrides,
  };
}

test("groups by method and templated path, merging schemas", () => {
  const warnings: string[] = [];
  const { groups, dominantOrigin } = groupEntries(
    [
      entry({
        path: "/api/users/1",
        method: "GET",
        status: 200,
        responseBody: '{"id":1,"name":"a"}',
      }),
      entry({
        path: "/api/users/2",
        method: "GET",
        status: 200,
        responseBody: '{"id":2,"name":"b","extra":true}',
      }),
      entry({ path: "/api/users/1", method: "DELETE", status: 204 }),
    ],
    warnings,
  );
  assert.equal(groups.length, 2);
  const get = groups.find((g) => g.method === "GET")!;
  assert.equal(get.path, "/api/users/{id}");
  const body = get.responses.find((r) => r.status === 200)!.body!;
  assert.equal(body.type.kind, "object");
  if (body.type.kind === "object") {
    assert.equal(body.type.fields.get("name")?.required, true);
    assert.equal(body.type.fields.get("extra")?.required, false);
  }
  const del = groups.find((g) => g.method === "DELETE")!;
  assert.equal(del.responses[0].body, undefined);
  assert.equal(dominantOrigin, "https://api.example.com");
  assert.equal(warnings.length, 0);
});

test("merges query params and request bodies", () => {
  const warnings: string[] = [];
  const { groups } = groupEntries(
    [
      entry({
        path: "/api/search",
        method: "GET",
        query: [
          ["q", "a"],
          ["page", "1"],
        ],
      }),
      entry({ path: "/api/search", method: "GET", query: [["q", "b"]] }),
      entry({
        path: "/api/users",
        method: "POST",
        requestBody: '{"name":"a"}',
        status: 201,
      }),
      entry({
        path: "/api/users",
        method: "POST",
        requestBody: '{"name":"b","age":30}',
        status: 201,
      }),
    ],
    warnings,
  );
  const search = groups.find((g) => g.path === "/api/search")!;
  assert.deepEqual(search.queryParams, [
    ["q", "a"],
    ["page", "1"],
  ]);
  const post = groups.find((g) => g.method === "POST")!;
  assert.equal(post.requestBody!.type.kind, "object");
});

test("detects basic auth and warns on non-JSON bodies", () => {
  const warnings: string[] = [];
  const { groups } = groupEntries(
    [
      entry({
        path: "/api/x",
        method: "GET",
        hasBasicAuth: true,
        responseBody: "hello",
        status: 200,
      }),
    ],
    warnings,
  );
  assert.equal(groups[0].hasBasicAuth, true);
  assert.ok(warnings.some((w) => w.includes("non-JSON")));
});

test("multiple origins warns and picks the dominant one", () => {
  const warnings: string[] = [];
  const { dominantOrigin } = groupEntries(
    [
      entry({ origin: "https://a.example.com" }),
      entry({ origin: "https://a.example.com" }),
      entry({ origin: "https://b.example.com" }),
    ],
    warnings,
  );
  assert.equal(dominantOrigin, "https://a.example.com");
  assert.ok(warnings.some((w) => w.includes("Multiple origins")));
});
