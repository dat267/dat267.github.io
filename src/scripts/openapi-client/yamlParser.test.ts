import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseYaml } from "./yamlParser.ts";

test("parses a simple mapping", () => {
  assert.deepEqual(parseYaml("a: 1\nb: hello\nc: true\nd: null"), {
    a: 1,
    b: "hello",
    c: true,
    d: null,
  });
});

test("parses nested mappings", () => {
  assert.deepEqual(
    parseYaml("openapi: 3.0.3\ninfo:\n  title: API\n  version: 1.0.0"),
    { openapi: "3.0.3", info: { title: "API", version: "1.0.0" } },
  );
});

test("parses sequences of scalars", () => {
  assert.deepEqual(parseYaml("tags:\n  - users\n  - admin"), {
    tags: ["users", "admin"],
  });
});

test("parses sequences of mappings", () => {
  assert.deepEqual(
    parseYaml("parameters:\n  - name: id\n    in: path\n    required: true"),
    { parameters: [{ name: "id", in: "path", required: true }] },
  );
});

test("parses flow collections", () => {
  assert.deepEqual(
    parseYaml(
      'required: [id, name]\ntype: [number, "null"]\nobj: {a: 1, b: two}',
    ),
    {
      required: ["id", "name"],
      type: ["number", "null"],
      obj: { a: 1, b: "two" },
    },
  );
});

test("parses quoted strings and comments", () => {
  assert.deepEqual(
    parseYaml(
      "title: \"Hello, world\" # trailing comment\nurl: 'https://x.com/a'",
    ),
    { title: "Hello, world", url: "https://x.com/a" },
  );
});

test("parses block scalars", () => {
  assert.deepEqual(
    parseYaml("description: |\n  Line one\n  Line two\nnext: true"),
    { description: "Line one\nLine two", next: true },
  );
});

test("parses folded block scalars", () => {
  assert.deepEqual(parseYaml("description: >\n  folded line\n  one\nnext: 1"), {
    description: "folded line one",
    next: 1,
  });
});

test("empty value becomes null", () => {
  assert.deepEqual(parseYaml("servers:\nurl: \n"), {
    servers: null,
    url: null,
  });
});

test("parses urls in plain scalars", () => {
  assert.deepEqual(parseYaml("url: https://api.example.com/v1"), {
    url: "https://api.example.com/v1",
  });
});

test("handles numbers and negative numbers", () => {
  assert.deepEqual(parseYaml("a: -1\nb: 3.14\nc: 200"), {
    a: -1,
    b: 3.14,
    c: 200,
  });
});
