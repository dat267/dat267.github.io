import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateCode } from "./generate.ts";

const CMD =
  'curl -X POST https://api.example.com/users -H "X-Custom: 1" -d \'{"name":"Jane"}\'';

test("js and typescript targets", () => {
  assert.ok(generateCode(CMD, "js").code.includes("fetch("));
  assert.ok(generateCode(CMD, "typescript").code.includes("fetch("));
});

test("go target", () => {
  assert.ok(generateCode(CMD, "go").code.includes("http.NewRequest"));
});

test("rust target", () => {
  assert.ok(generateCode(CMD, "rust").code.includes("reqwest"));
});

test("python target", () => {
  assert.ok(generateCode(CMD, "python").code.includes("requests.request"));
});

test("powershell target", () => {
  assert.ok(generateCode(CMD, "powershell").code.includes("Invoke-RestMethod"));
});

test("exposes warnings", () => {
  const result = generateCode('curl -F "a=@b" https://api.example.com', "js");
  assert.ok(result.warnings.some((w) => w.includes("-F")));
});
