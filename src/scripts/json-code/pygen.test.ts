import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generatePython } from "./pygen.ts";

test("generates dataclasses with Optional and list", () => {
  const root = inferType({
    name: "Jane",
    age: null,
    tags: ["a"],
    meta: { ok: true },
  });
  const out = generatePython(root, "User");
  assert.ok(out.includes("from __future__ import annotations"));
  assert.ok(out.includes("@dataclass"));
  assert.ok(out.includes("class User:"));
  assert.ok(out.includes("    name: str"));
  assert.ok(out.includes("    age: Optional[Any] = None"));
  assert.ok(out.includes("    tags: list[str]"));
  assert.ok(out.includes("    meta: Meta"));
  assert.ok(out.includes("class Meta:"));
  assert.ok(out.includes("    ok: bool"));
});

test("keyword keys are escaped", () => {
  const root = inferType({ class: 1, type: "x", name: 2 });
  const out = generatePython(root, "User");
  assert.ok(out.includes("    class_: float"));
  assert.ok(out.includes("    type_: str"));
  assert.ok(out.includes("    name: float"));
});

test("required fields come before defaulted fields", () => {
  const root = inferType([{ a: 1, b: "x" }, { a: 2 }]);
  const out = generatePython(root, "Row");
  const idxA = out.indexOf("    a: float");
  const idxB = out.indexOf("    b: Optional[str] = None");
  assert.ok(idxA >= 0 && idxB > idxA);
});
