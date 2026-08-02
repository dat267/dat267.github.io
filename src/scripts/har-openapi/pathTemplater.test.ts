import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pathParams, templatePath } from "./pathTemplater.ts";

test("templates numeric segments", () => {
  assert.equal(templatePath("/api/users/123"), "/api/users/{id}");
});

test("templates uuids", () => {
  assert.equal(
    templatePath("/api/files/6f1c1e2b-8a4d-4a1a-9f0b-1234567890ab"),
    "/api/files/{id}",
  );
});

test("numbers multiple segments uniquely", () => {
  assert.equal(templatePath("/users/1/posts/2"), "/users/{id}/posts/{id2}");
});

test("leaves named segments and extensions", () => {
  assert.equal(templatePath("/api/users/list.json"), "/api/users/list.json");
});

test("normalizes slashes", () => {
  assert.equal(templatePath("/"), "/");
  assert.equal(templatePath("/a//b/"), "/a/b");
});

test("pathParams extracts unique names", () => {
  assert.deepEqual(pathParams("/users/{id}/posts/{id2}"), ["id", "id2"]);
});
