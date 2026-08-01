import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generateGo } from "./gogen.ts";

test("generates http.NewRequest", () => {
  const req = parseCurl(
    'curl -X POST https://api.example.com/users -H "X-Custom: 1" -d \'{"name":"Jane"}\'',
  );
  const out = generateGo(req);
  assert.ok(
    out.includes(
      'req, err := http.NewRequest("POST", "https://api.example.com/users", bytes.NewBufferString("{\\"name\\":\\"Jane\\"}"))',
    ),
  );
  assert.ok(out.includes('req.Header.Set("X-Custom", "1")'));
  assert.ok(out.includes("http.DefaultClient.Do(req)"));
});

test("GET without body passes nil", () => {
  const out = generateGo(parseCurl("curl https://api.example.com"));
  assert.ok(
    out.includes('http.NewRequest("GET", "https://api.example.com", nil)'),
  );
  assert.ok(!out.includes("bytes.NewBufferString"));
});
