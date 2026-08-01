import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import {
  collectObjects,
  pascalCase,
  pyIdent,
  rustIdent,
  snakeCase,
  tsIdent,
} from "./names.ts";

test("pascalCase handles separators", () => {
  assert.equal(pascalCase("user_profile"), "UserProfile");
  assert.equal(pascalCase("user"), "User");
  assert.equal(pascalCase("order-item"), "OrderItem");
  assert.equal(pascalCase(""), "Type");
});

test("snakeCase converts camelCase", () => {
  assert.equal(snakeCase("userName"), "user_name");
  assert.equal(snakeCase("user"), "user");
  assert.equal(snakeCase("HTTPCode"), "http_code");
});

test("pyIdent escapes Python keywords", () => {
  assert.equal(pyIdent("class"), "class_");
  assert.equal(pyIdent("from"), "from_");
  assert.equal(pyIdent("type"), "type_");
  assert.equal(pyIdent("import"), "import_");
  assert.equal(pyIdent("range"), "range_");
  assert.equal(pyIdent("in"), "in_");
  assert.equal(pyIdent("name"), "name");
});

test("identifiers", () => {
  assert.equal(tsIdent("name"), "name");
  assert.equal(tsIdent("my-key"), '"my-key"');
  assert.equal(pyIdent("my-key"), "my_key");
  assert.equal(rustIdent("type"), "_type");
  assert.equal(rustIdent("userName"), "user_name");
  assert.equal(rustIdent("ok"), "ok");
});

test("collectObjects names nested types", () => {
  const root = inferType({ meta: { tags: ["a"] }, list: [{ id: 1 }] });
  const { root: r, all } = collectObjects(root, "Root");
  assert.ok(r);
  assert.equal(r.name, "Root");
  const names = all.map((t) => t.name).sort();
  assert.deepEqual(names, ["List", "Meta", "Root"]);
  const list = all.find((t) => t.name === "List");
  assert.equal(list?.fields.get("id")?.type.kind, "number");
});

test("collectObjects returns null root for scalars", () => {
  const { root } = collectObjects(inferType(42), "Root");
  assert.equal(root, null);
});
