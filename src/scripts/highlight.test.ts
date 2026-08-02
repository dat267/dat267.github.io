import { strict as assert } from "node:assert";
import { test } from "node:test";
import { highlight } from "./highlight.ts";

test("produces a shiki code block", async () => {
  const html = await highlight("const x = 1;", "typescript");
  assert.ok(html.startsWith("<pre"));
  assert.ok(html.includes('class="shiki'));
  assert.ok(html.includes("<code>"));
  assert.ok(html.includes("--shiki-light"));
  assert.ok(html.includes("--shiki-dark"));
});

test("escapes html in code", async () => {
  const html = await highlight("<script>alert(1)</script>", "typescript");
  assert.ok(!html.includes("<script>alert(1)</script>"));
});

test("falls back for unknown langs", async () => {
  const html = await highlight("hello", "not-a-lang");
  assert.ok(html.includes("<code>"));
});
