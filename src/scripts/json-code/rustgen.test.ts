import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateRust } from "./rustgen.ts";

test("generates serde structs", () => {
  const root = inferType([
    { userName: "Jane", age: null, tags: ["a"], type: 1 },
    { userName: "Bob", age: 30, tags: [], type: 2 },
  ]);
  const out = generateRust(root, "User");
  assert.ok(out.includes("use serde::{Deserialize, Serialize};"));
  assert.ok(out.includes("pub struct User {"));
  assert.ok(out.includes("pub user_name: String,"));
  assert.ok(out.includes('#[serde(rename = "userName")]'));
  assert.ok(out.includes("pub age: Option<f64>,"));
  assert.ok(out.includes("pub tags: Vec<String>,"));
  assert.ok(out.includes("pub _type: f64,"));
});

test("scalar top-level input emits a type alias", () => {
  const out = generateRust(inferType(true), "Root");
  assert.equal(
    out,
    "use serde::{Deserialize, Serialize};\n\npub type Root = bool;\n",
  );
});
