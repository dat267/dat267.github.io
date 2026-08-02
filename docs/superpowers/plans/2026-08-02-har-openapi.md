# HAR → OpenAPI 3.0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third client-side web app (`Tools/har-to-openapi`) that converts a pasted HTTP Archive (HAR) JSON export into an OpenAPI 3.0.3 spec in YAML, entirely in the browser.

**Architecture:** A pure-TypeScript engine in `src/scripts/har-openapi/` (tested with `node --test`, no new deps) that parses HAR entries, templates concrete ID path segments, groups entries by origin/method/templated-path, infers request/response schemas by reusing `inferType`/`mergeFields` from `src/scripts/json-code/ast.ts`, renders them as OpenAPI-3.0-compatible inline JSON Schemas, assembles the OpenAPI document, and serializes it to YAML. A `HarToOpenApi.astro` component wires the UI to the orchestrator and reuses the existing `.app` stylesheet.

**Tech Stack:** Astro 7, Starlight 0.41, vanilla TypeScript, Node 26 built-in test runner. No new dependencies.

## Global Constraints

- **No new npm dependencies.** Runtime deps remain `astro` + `@astrojs/starlight` only; tests use `node --test`.
- **Explicit `.ts` extensions** in all relative imports between script modules.
- **Reuse, don't fork:** schema inference MUST use `inferType`/`mergeFields` from `../json-code/ast.ts` (exports confirmed: `inferType(value: unknown): Field`, `mergeFields(a: Field, b: Field): Field`, types `Field`, `JsonType`).
- **OpenAPI 3.0.3** output in **YAML**. Inline JSON Schemas only — no `$ref` (OpenAPI 3.0 `$ref` would require `#/components/schemas/`).
- **No behavior beyond styling constraints for the component:** all dynamic text via `textContent` (no XSS); component styled by the existing `src/styles/webapps.css` `.app` rules; `class="tall"` textarea, `primary`/`secondary` buttons.
- **Prettier must pass** on new `src/**/*.{md,css,ts}` files.
- **`npm run test:scripts`** (all tests incl. existing 67), **`npm run build`** (16 pages), **`npm run format:check`** must pass.
- **No commits** unless the user explicitly asks (AGENTS.md).

## File Structure

- `src/scripts/har-openapi/harTypes.ts` — HAR structural types
- `src/scripts/har-openapi/harParser.ts` — `parseHar(har, warnings): ParsedEntry[]`
- `src/scripts/har-openapi/pathTemplater.ts` — `templatePath`, `pathParams`
- `src/scripts/har-openapi/groupEntries.ts` — `groupEntries(entries, warnings): GroupResult`
- `src/scripts/har-openapi/schema.ts` — `schemaFromField(field): JsonSchema`
- `src/scripts/har-openapi/openapiBuilder.ts` — `buildOpenApi(result, meta): Record<string, unknown>`
- `src/scripts/har-openapi/yaml.ts` — `toYaml(value): string`
- `src/scripts/har-openapi/generate.ts` — `generateOpenApi(harJson): { spec, warnings }`
- `src/components/HarToOpenApi.astro`
- `src/content/docs/Tools/har-to-openapi.mdx`
- `AGENTS.md` (modify — Client-Side Web Apps bullet)
- `docs/superpowers/plans/2026-08-02-har-openapi.md` (this plan)

---

### Task 1: HAR types + parser

**Files:**
- Create: `src/scripts/har-openapi/harTypes.ts`
- Create: `src/scripts/har-openapi/harParser.ts`
- Test: `src/scripts/har-openapi/harParser.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3-7):
  - `export interface ParsedEntry { origin: string; path: string; method: string; query: Array<[string, string]>; requestHeaders: Array<[string, string]>; requestBody?: string; requestContentType?: string; status: number; responseBody?: string; responseContentType?: string; hasBasicAuth: boolean }`
  - `parseHar(har: unknown, warnings: string[]): ParsedEntry[]` (throws `Error` when `log.entries` is not an array)

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/harParser.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseHar } from "./harParser.ts";

function har(entries: unknown[]): unknown {
  return { log: { entries } };
}

test("parses a basic entry", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users?page=2",
          headers: [{ name: "X-A", value: "1" }],
        },
        response: {
          status: 200,
          content: { mimeType: "application/json", text: '{"id":1}' },
        },
      },
    ]),
    warnings,
  );
  assert.equal(parsed.length, 1);
  const e = parsed[0];
  assert.equal(e.method, "GET");
  assert.equal(e.origin, "https://api.example.com");
  assert.equal(e.path, "/users");
  assert.deepEqual(e.query, [["page", "2"]]);
  assert.deepEqual(e.requestHeaders, [["X-A", "1"]]);
  assert.equal(e.status, 200);
  assert.equal(e.responseBody, '{"id":1}');
  assert.equal(e.responseContentType, "application/json");
  assert.equal(warnings.length, 0);
});

test("extracts postData and basic auth flag", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: {
          method: "POST",
          url: "https://api.example.com/users",
          headers: [{ name: "Authorization", value: "Basic dXNlcjpwYXNz" }],
          postData: { mimeType: "application/json", text: '{"name":"Jane"}' },
        },
        response: { status: 201, content: { mimeType: "application/json", text: "{}" } },
      },
    ]),
    warnings,
  );
  const e = parsed[0];
  assert.equal(e.requestBody, '{"name":"Jane"}');
  assert.equal(e.requestContentType, "application/json");
  assert.equal(e.hasBasicAuth, true);
  assert.equal(e.status, 201);
});

test("decodes base64 response bodies as utf-8", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: { method: "GET", url: "https://api.example.com/x" },
        response: { status: 200, content: { encoding: "base64", text: btoa('{"ok":true}') } },
      },
    ]),
    warnings,
  );
  assert.equal(parsed[0].responseBody, '{"ok":true}');
});

test("skips unparseable base64 with a warning", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      {
        request: { method: "GET", url: "https://api.example.com/x" },
        response: { status: 200, content: { encoding: "base64", text: "@@@notbase64" } },
      },
    ]),
    warnings,
  );
  assert.equal(parsed[0].responseBody, undefined);
  assert.ok(warnings.some((w) => w.includes("base64")));
});

test("invalid HAR structure throws", () => {
  assert.throws(() => parseHar({}, []), /log.entries/);
});

test("skips entries with bad URLs and warns", () => {
  const warnings: string[] = [];
  const parsed = parseHar(
    har([
      { request: { method: "GET", url: "not a url" }, response: { status: 200 } },
      { request: { method: "GET", url: "https://ok.example.com/" }, response: { status: 200 } },
    ]),
    warnings,
  );
  assert.equal(parsed.length, 1);
  assert.equal(warnings.length, 1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/harParser.test.ts`
Expected: FAIL — `Cannot find module './harParser.ts'`

- [ ] **Step 3: Implement `harTypes.ts` and `harParser.ts`**

Create `src/scripts/har-openapi/harTypes.ts`:

```ts
export interface HarEntry {
  request: {
    method: string;
    url: string;
    headers?: Array<{ name: string; value: string }>;
    postData?: { mimeType?: string; text?: string };
  };
  response: {
    status: number;
    content?: { mimeType?: string; text?: string; encoding?: string };
  };
}

export interface HarFile {
  log?: {
    title?: string;
    creator?: { name?: string };
    entries?: HarEntry[];
  };
}
```

Create `src/scripts/har-openapi/harParser.ts`:

```ts
import type { HarFile } from "./harTypes.ts";

export interface ParsedEntry {
  origin: string;
  path: string;
  method: string;
  query: Array<[string, string]>;
  requestHeaders: Array<[string, string]>;
  requestBody?: string;
  requestContentType?: string;
  status: number;
  responseBody?: string;
  responseContentType?: string;
  hasBasicAuth: boolean;
}

export function parseHar(har: unknown, warnings: string[]): ParsedEntry[] {
  const log = (har as HarFile)?.log;
  const rawEntries = log?.entries;
  if (!Array.isArray(rawEntries)) {
    throw new Error("Invalid HAR: expected log.entries to be an array.");
  }
  const out: ParsedEntry[] = [];
  for (const raw of rawEntries) {
    const req = raw?.request;
    const res = raw?.response;
    if (!req || typeof req.url !== "string" || typeof req.method !== "string") {
      warnings.push("Skipped an entry missing request.url or request.method.");
      continue;
    }
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      warnings.push(`Skipped entry with unparseable URL: ${req.url}`);
      continue;
    }
    const method = req.method.toUpperCase();
    const query: Array<[string, string]> = [];
    url.searchParams.forEach((value, key) => query.push([key, value]));
    const requestHeaders = normalizeHeaders(req.headers);
    const hasBasicAuth = requestHeaders.some(
      ([name, value]) => name.toLowerCase() === "authorization" && /^basic\b/i.test(value),
    );
    let requestBody: string | undefined;
    let requestContentType: string | undefined;
    if (req.postData && typeof req.postData.text === "string") {
      requestBody = req.postData.text;
      requestContentType = req.postData.mimeType;
    }
    let responseBody: string | undefined;
    let responseContentType: string | undefined;
    if (res?.content) {
      responseContentType = res.content.mimeType;
      if (typeof res.content.text === "string") {
        if (res.content.encoding === "base64") {
          try {
            responseBody = decodeBase64(res.content.text);
          } catch {
            warnings.push(`Skipped unparseable base64 response body for ${method} ${url.pathname}.`);
          }
        } else {
          responseBody = res.content.text;
        }
      }
    }
    out.push({
      origin: url.origin,
      path: url.pathname,
      method,
      query,
      requestHeaders,
      status: typeof res?.status === "number" ? res.status : 0,
      hasBasicAuth,
      ...(requestBody !== undefined ? { requestBody, requestContentType } : {}),
      ...(responseBody !== undefined ? { responseBody, responseContentType } : {}),
    });
  }
  return out;
}

function normalizeHeaders(
  headers: Array<{ name: string; value: string }> | undefined,
): Array<[string, string]> {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => h && typeof h.name === "string")
    .map((h) => [h.name, typeof h.value === "string" ? h.value : ""]);
}

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) throw new Error("invalid base64");
  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/harParser.test.ts`
Expected: PASS (6 tests)

---

### Task 2: Path templater

**Files:**
- Create: `src/scripts/har-openapi/pathTemplater.ts`
- Test: `src/scripts/har-openapi/pathTemplater.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3 and 5):
  - `templatePath(path: string): string`
  - `pathParams(template: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/pathTemplater.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/pathTemplater.test.ts`
Expected: FAIL — `Cannot find module './pathTemplater.ts'`

- [ ] **Step 3: Implement `pathTemplater.ts`**

Create `src/scripts/har-openapi/pathTemplater.ts`:

```ts
const NUM_RE = /^\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function templatePath(path: string): string {
  const cleaned = path.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  const segments = cleaned.split("/").filter((s) => s.length > 0);
  let idCount = 0;
  const templated = segments.map((seg) => {
    if (NUM_RE.test(seg) || UUID_RE.test(seg)) {
      idCount += 1;
      return idCount === 1 ? "{id}" : `{id${idCount}}`;
    }
    return seg;
  });
  return "/" + templated.join("/");
}

export function pathParams(template: string): string[] {
  const names = [...template.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  return [...new Set(names)];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/pathTemplater.test.ts`
Expected: PASS (6 tests)

---

### Task 3: Grouping

**Files:**
- Create: `src/scripts/har-openapi/groupEntries.ts`
- Test: `src/scripts/har-openapi/groupEntries.test.ts`

**Interfaces:**
- Consumes: `inferType`, `mergeFields`, `type Field` from `../json-code/ast.ts`; `templatePath` from `./pathTemplater.ts`; `type ParsedEntry` from `./harParser.ts`
- Produces (consumed by Tasks 5 and 7):
  - `export interface EndpointResponse { status: number; body?: Field; contentType?: string }`
  - `export interface EndpointGroup { origin: string; method: string; path: string; queryParams: Array<[string, string]>; requestBody?: Field; requestContentType?: string; responses: EndpointResponse[]; hasBasicAuth: boolean }`
  - `export interface GroupResult { groups: EndpointGroup[]; dominantOrigin: string }`
  - `groupEntries(entries: ParsedEntry[], warnings: string[]): GroupResult`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/groupEntries.test.ts`:

```ts
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
      entry({ path: "/api/users/1", method: "GET", status: 200, responseBody: '{"id":1,"name":"a"}' }),
      entry({ path: "/api/users/2", method: "GET", status: 200, responseBody: '{"id":2,"name":"b","extra":true}' }),
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
      entry({ path: "/api/search", method: "GET", query: [["q", "a"], ["page", "1"]] }),
      entry({ path: "/api/search", method: "GET", query: [["q", "b"]] }),
      entry({ path: "/api/users", method: "POST", requestBody: '{"name":"a"}', status: 201 }),
      entry({ path: "/api/users", method: "POST", requestBody: '{"name":"b","age":30}', status: 201 }),
    ],
    warnings,
  );
  const search = groups.find((g) => g.path === "/api/search")!;
  assert.deepEqual(search.queryParams, [["q", "a"], ["page", "1"]]);
  const post = groups.find((g) => g.method === "POST")!;
  assert.equal(post.requestBody!.type.kind, "object");
});

test("detects basic auth and warns on non-JSON bodies", () => {
  const warnings: string[] = [];
  const { groups } = groupEntries(
    [entry({ path: "/api/x", method: "GET", hasBasicAuth: true, responseBody: "hello", status: 200 })],
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/groupEntries.test.ts`
Expected: FAIL — `Cannot find module './groupEntries.ts'`

- [ ] **Step 3: Implement `groupEntries.ts`**

Create `src/scripts/har-openapi/groupEntries.ts`:

```ts
import { inferType, mergeFields, type Field } from "../json-code/ast.ts";
import { templatePath } from "./pathTemplater.ts";
import type { ParsedEntry } from "./harParser.ts";

export interface EndpointResponse {
  status: number;
  body?: Field;
  contentType?: string;
}

export interface EndpointGroup {
  origin: string;
  method: string;
  path: string;
  queryParams: Array<[string, string]>;
  requestBody?: Field;
  requestContentType?: string;
  responses: EndpointResponse[];
  hasBasicAuth: boolean;
}

export interface GroupResult {
  groups: EndpointGroup[];
  dominantOrigin: string;
}

export function groupEntries(entries: ParsedEntry[], warnings: string[]): GroupResult {
  const byKey = new Map<string, EndpointGroup>();
  const originCounts = new Map<string, number>();
  for (const e of entries) {
    originCounts.set(e.origin, (originCounts.get(e.origin) ?? 0) + 1);
    const key = `${e.origin}|${e.method}|${templatePath(e.path)}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        origin: e.origin,
        method: e.method,
        path: templatePath(e.path),
        queryParams: [],
        responses: [],
        hasBasicAuth: false,
      };
      byKey.set(key, group);
    }
    for (const [name, value] of e.query) {
      if (!group.queryParams.some(([n]) => n === name)) {
        group.queryParams.push([name, value]);
      }
    }
    group.hasBasicAuth = group.hasBasicAuth || e.hasBasicAuth;
    if (e.requestBody !== undefined) {
      group.requestContentType = e.requestContentType;
      const value = tryParseJson(e.requestBody);
      if (value !== undefined) {
        const field = inferType(value);
        group.requestBody = group.requestBody
          ? mergeFields(group.requestBody, field)
          : field;
      } else {
        warnings.push(`Skipped non-JSON request body for ${e.method} ${group.path}.`);
      }
    }
    const existing = group.responses.find((r) => r.status === e.status);
    if (e.responseBody !== undefined) {
      const value = tryParseJson(e.responseBody);
      if (value !== undefined) {
        const field = inferType(value);
        if (existing) {
          existing.body = existing.body ? mergeFields(existing.body, field) : field;
          existing.contentType = e.responseContentType;
        } else {
          group.responses.push({
            status: e.status,
            body: field,
            contentType: e.responseContentType,
          });
        }
      } else {
        warnings.push(
          `Skipped non-JSON response body for ${e.method} ${group.path} (${e.status}).`,
        );
        if (!existing) group.responses.push({ status: e.status });
      }
    } else if (!existing) {
      group.responses.push({ status: e.status });
    }
  }
  const dominantOrigin =
    [...originCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  if (originCounts.size > 1) {
    warnings.push(`Multiple origins detected; using ${dominantOrigin} for the servers list.`);
  }
  return { groups: [...byKey.values()], dominantOrigin };
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/groupEntries.test.ts`
Expected: PASS (4 tests)

---

### Task 4: OpenAPI-compatible schema renderer

**Files:**
- Create: `src/scripts/har-openapi/schema.ts`
- Test: `src/scripts/har-openapi/schema.test.ts`

**Interfaces:**
- Consumes: `Field`, `JsonType` from `../json-code/ast.ts`
- Produces (consumed by Tasks 5 and 7): `schemaFromField(field: Field): JsonSchema` where `type JsonSchema = Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/schema.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType, mergeFields } from "../json-code/ast.ts";
import { schemaFromField } from "./schema.ts";

test("scalars", () => {
  assert.deepEqual(schemaFromField(inferType("x")), { type: "string" });
  assert.deepEqual(schemaFromField(inferType(3)), { type: "number" });
  assert.deepEqual(schemaFromField(inferType(true)), { type: "boolean" });
});

test("nullable becomes a type array", () => {
  const f = mergeFields(inferType(1), inferType(null));
  assert.deepEqual(schemaFromField(f), { type: ["number", "null"] });
});

test("arrays and nested objects", () => {
  const f = inferType({ tags: ["a", "b"], meta: { ok: true } });
  assert.deepEqual(schemaFromField(f), {
    type: "object",
    additionalProperties: false,
    properties: {
      tags: { type: "array", items: { type: "string" } },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
    },
    required: ["tags", "meta"],
  });
});

test("heterogeneous array collapses to open schema", () => {
  assert.deepEqual(schemaFromField(inferType([1, "x"])), {
    type: "array",
    items: {},
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/schema.test.ts`
Expected: FAIL — `Cannot find module './schema.ts'`

- [ ] **Step 3: Implement `schema.ts`**

Create `src/scripts/har-openapi/schema.ts`:

```ts
import type { Field, JsonType } from "../json-code/ast.ts";

export type JsonSchema = Record<string, unknown>;

export function schemaFromField(field: Field): JsonSchema {
  const schema = baseSchema(field.type);
  if (field.nullable && "type" in schema) {
    const type = Array.isArray(schema.type) ? schema.type : [schema.type];
    return { ...schema, type: [...type, "null"] };
  }
  return schema;
}

function baseSchema(t: JsonType): JsonSchema {
  switch (t.kind) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
    case "any":
      return {};
    case "array":
      return { type: "array", items: schemaFromField(t.items) };
    case "object": {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, f] of t.fields) {
        properties[key] = schemaFromField(f);
        if (f.required) required.push(key);
      }
      return {
        type: "object",
        additionalProperties: false,
        properties,
        ...(required.length ? { required } : {}),
      };
    }
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/schema.test.ts`
Expected: PASS (4 tests)

---

### Task 5: OpenAPI document builder

**Files:**
- Create: `src/scripts/har-openapi/openapiBuilder.ts`
- Test: `src/scripts/har-openapi/openapiBuilder.test.ts`

**Interfaces:**
- Consumes: `GroupResult`, `EndpointGroup` from `./groupEntries.ts`; `pathParams` from `./pathTemplater.ts`; `schemaFromField` from `./schema.ts`
- Produces (consumed by Task 7): `buildOpenApi(result: GroupResult, meta: { title: string }): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/openapiBuilder.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildOpenApi } from "./openapiBuilder.ts";
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

test("builds an OpenAPI 3.0.3 document", () => {
  const { groups, dominantOrigin } = groupEntries(
    [entry({ path: "/api/users/1", query: [["q", "users"]], responseBody: '{"id":1}' })],
    [],
  );
  const doc = buildOpenApi({ groups, dominantOrigin }, { title: "Test API" });
  assert.equal(doc.openapi, "3.0.3");
  assert.deepEqual(doc.info, { title: "Test API", version: "1.0.0" });
  assert.deepEqual(doc.servers, [{ url: "https://api.example.com" }]);
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  const op = paths["/api/users/{id}"].get as Record<string, unknown>;
  assert.deepEqual(op.tags, ["api"]);
  assert.equal(op.operationId, "get_api_users_id");
  const parameters = op.parameters as Record<string, unknown>[];
  assert.deepEqual(parameters[0], {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string" },
  });
  assert.deepEqual(parameters[1], {
    name: "q",
    in: "query",
    schema: { type: "string" },
  });
  const responses = op.responses as Record<string, Record<string, unknown>>;
  assert.deepEqual(responses["200"], {
    description: "OK",
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { id: { type: "number" } },
          required: ["id"],
        },
      },
    },
  });
});

test("emits requestBody and basicAuth security", () => {
  const { groups, dominantOrigin } = groupEntries(
    [
      entry({
        path: "/api/users",
        method: "POST",
        hasBasicAuth: true,
        requestBody: '{"name":"Jane"}',
        requestContentType: "application/json",
        status: 201,
        responseBody: '{"id":1}',
      }),
    ],
    [],
  );
  const doc = buildOpenApi({ groups, dominantOrigin }, { title: "API" });
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  const op = paths["/api/users"].post as Record<string, unknown>;
  assert.deepEqual(op.requestBody, {
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    },
  });
  assert.deepEqual(op.security, [{ basicAuth: [] }]);
  assert.deepEqual(doc.components, {
    securitySchemes: { basicAuth: { type: "http", scheme: "basic" } },
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/openapiBuilder.test.ts`
Expected: FAIL — `Cannot find module './openapiBuilder.ts'`

- [ ] **Step 3: Implement `openapiBuilder.ts`**

Create `src/scripts/har-openapi/openapiBuilder.ts`:

```ts
import type { EndpointGroup, GroupResult } from "./groupEntries.ts";
import { pathParams } from "./pathTemplater.ts";
import { schemaFromField } from "./schema.ts";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export function buildOpenApi(
  result: GroupResult,
  meta: { title: string },
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const group of result.groups) {
    const method = group.method.toLowerCase();
    paths[group.path] = { ...(paths[group.path] ?? {}), [method]: buildOperation(group) };
  }
  const hasAuth = result.groups.some((g) => g.hasBasicAuth);
  return {
    openapi: "3.0.3",
    info: { title: meta.title || "API", version: "1.0.0" },
    servers: [{ url: result.dominantOrigin }],
    paths,
    components: hasAuth
      ? { securitySchemes: { basicAuth: { type: "http", scheme: "basic" } } }
      : {},
  };
}

function buildOperation(group: EndpointGroup): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [];
  for (const name of pathParams(group.path)) {
    parameters.push({ name, in: "path", required: true, schema: { type: "string" } });
  }
  for (const [name, value] of group.queryParams) {
    parameters.push({ name, in: "query", schema: querySchema(value) });
  }
  const op: Record<string, unknown> = {
    tags: [group.path.split("/").filter(Boolean)[0] ?? "default"],
    operationId: operationId(group),
  };
  if (parameters.length) op.parameters = parameters;
  if (group.requestBody !== undefined) {
    op.requestBody = {
      content: {
        [group.requestContentType ?? "application/json"]: {
          schema: schemaFromField(group.requestBody),
        },
      },
    };
  }
  const responses: Record<string, unknown> = {};
  for (const r of group.responses) {
    const resp: Record<string, unknown> = {
      description: STATUS_TEXT[r.status] ?? `HTTP ${r.status}`,
    };
    if (r.body !== undefined) {
      resp.content = {
        [r.contentType ?? "application/json"]: { schema: schemaFromField(r.body) },
      };
    }
    responses[String(r.status)] = resp;
  }
  op.responses = responses;
  if (group.hasBasicAuth) op.security = [{ basicAuth: [] }];
  return op;
}

function operationId(group: EndpointGroup): string {
  const name = group.path
    .split("/")
    .filter(Boolean)
    .map((seg) => (seg.startsWith("{") ? "id" : seg))
    .join("_");
  return `${group.method.toLowerCase()}_${name}`;
}

function querySchema(value: string): Record<string, unknown> {
  if (/^\d+$/.test(value)) return { type: "integer" };
  if (/^-?\d+\.\d+$/.test(value)) return { type: "number" };
  if (value === "true" || value === "false") return { type: "boolean" };
  return { type: "string" };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/openapiBuilder.test.ts`
Expected: PASS (2 tests)

---

### Task 6: YAML serializer

**Files:**
- Create: `src/scripts/har-openapi/yaml.ts`
- Test: `src/scripts/har-openapi/yaml.test.ts`

**Interfaces:**
- Produces (consumed by Task 7): `toYaml(value: unknown): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/yaml.test.ts`:

```ts
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
  assert.equal(toYaml({ type: ["number", "null"] }), 'type: [number, "null"]\n');
});

test("path keys stay bare", () => {
  assert.equal(
    toYaml({ "/users/{id}": { get: {} } }),
    "/users/{id}:\n  get: {}\n",
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/yaml.test.ts`
Expected: FAIL — `Cannot find module './yaml.ts'`

- [ ] **Step 3: Implement `yaml.ts`**

Create `src/scripts/har-openapi/yaml.ts`:

```ts
const YAML_KEYWORDS = new Set(["true", "false", "null", "yes", "no", "on", "off", "~"]);

export function toYaml(value: unknown): string {
  return emit(value, 0) + "\n";
}

function emit(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return pad + "null";
  if (typeof value === "string") return pad + scalar(value);
  if (typeof value === "number") return pad + String(value);
  if (typeof value === "boolean") return pad + (value ? "true" : "false");
  if (Array.isArray(value)) {
    if (value.length === 0) return pad + "[]";
    if (value.every(isScalar)) return pad + "[" + value.map(scalar).join(", ") + "]";
    const lines: string[] = [];
    for (const item of value) {
      if (isScalar(item)) {
        lines.push(pad + "- " + scalar(item));
        continue;
      }
      const child = emit(item, indent + 1);
      const [first, ...rest] = child.split("\n");
      lines.push(pad + "- " + first.trimStart());
      lines.push(...rest);
    }
    return lines.join("\n");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return pad + "{}";
  const lines: string[] = [];
  for (const [k, v] of entries) {
    if (isScalar(v)) {
      lines.push(pad + key(k) + ": " + scalar(v));
      continue;
    }
    if (Array.isArray(v) && v.every(isScalar)) {
      lines.push(pad + key(k) + ": [" + v.map(scalar).join(", ") + "]");
      continue;
    }
    if (typeof v === "object" && Object.keys(v).length === 0) {
      lines.push(pad + key(k) + ": {}");
      continue;
    }
    lines.push(pad + key(k) + ":");
    lines.push(emit(v, indent + 1));
  }
  return lines.join("\n");
}

function isScalar(v: unknown): v is string | number | boolean | null {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function scalar(v: string | number | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v.length === 0) return '""';
  if (YAML_KEYWORDS.has(v)) return JSON.stringify(v);
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(v) && /^[-0-9]/.test(v)) {
    return JSON.stringify(v);
  }
  if (/^[-?:,[\]{}#&*!|>'"%@`\s]/.test(v)) return JSON.stringify(v);
  if (/:\s/.test(v) || /\s#/.test(v)) return JSON.stringify(v);
  return v;
}

function key(s: string): string {
  if (/^[A-Za-z0-9_./{}-]+$/.test(s) && !YAML_KEYWORDS.has(s)) return s;
  return JSON.stringify(s);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/yaml.test.ts`
Expected: PASS (6 tests)

---

### Task 7: Orchestrator + integration test

**Files:**
- Create: `src/scripts/har-openapi/generate.ts`
- Test: `src/scripts/har-openapi/generate.test.ts`

**Interfaces:**
- Consumes: `parseHar` from `./harParser.ts`; `groupEntries` from `./groupEntries.ts`; `buildOpenApi` from `./openapiBuilder.ts`; `toYaml` from `./yaml.ts`
- Produces (consumed by Task 8): `generateOpenApi(harJson: string): { spec: string; warnings: string[] }`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/har-openapi/generate.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateOpenApi } from "./generate.ts";

const HAR = JSON.stringify({
  log: {
    creator: { name: "Chrome DevTools" },
    entries: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users?page=1",
          headers: [{ name: "Authorization", value: "Basic dXNlcjpwYXNz" }],
        },
        response: {
          status: 200,
          content: { mimeType: "application/json", text: '{"id":1,"name":"Jane"}' },
        },
      },
      {
        request: {
          method: "POST",
          url: "https://api.example.com/users",
          headers: [],
          postData: { mimeType: "application/json", text: '{"name":"Bob"}' },
        },
        response: {
          status: 201,
          content: { mimeType: "application/json", text: '{"id":2}' },
        },
      },
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users/123",
          headers: [],
        },
        response: {
          status: 200,
          content: { mimeType: "application/json", text: '{"id":123,"name":"Nested"}' },
        },
      },
    ],
  },
});

test("generates a YAML OpenAPI 3.0.3 spec", () => {
  const { spec, warnings } = generateOpenApi(HAR);
  assert.ok(spec.includes("openapi: 3.0.3"));
  assert.ok(spec.includes("title: Chrome DevTools"));
  assert.ok(spec.includes("paths:"));
  assert.ok(spec.includes("/users:"));
  assert.ok(spec.includes("/users/{id}:"));
  assert.ok(spec.includes("basicAuth:"));
  assert.equal(warnings.length, 0);
});

test("rejects invalid HAR structure", () => {
  assert.throws(() => generateOpenApi('{"log":{}}'), /log.entries/);
});

test("rejects invalid JSON", () => {
  assert.throws(() => generateOpenApi("{nope"), /Invalid JSON/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/har-openapi/generate.test.ts`
Expected: FAIL — `Cannot find module './generate.ts'`

- [ ] **Step 3: Implement `generate.ts`**

Create `src/scripts/har-openapi/generate.ts`:

```ts
import { buildOpenApi } from "./openapiBuilder.ts";
import { groupEntries } from "./groupEntries.ts";
import { parseHar } from "./harParser.ts";
import { toYaml } from "./yaml.ts";
import type { HarFile } from "./harTypes.ts";

export interface OpenApiResult {
  spec: string;
  warnings: string[];
}

export function generateOpenApi(harJson: string): OpenApiResult {
  const warnings: string[] = [];
  let har: unknown;
  try {
    har = JSON.parse(harJson);
  } catch (err) {
    throw new Error("Invalid JSON: " + (err instanceof Error ? err.message : String(err)));
  }
  const entries = parseHar(har, warnings);
  const grouped = groupEntries(entries, warnings);
  const doc = buildOpenApi(grouped, { title: deriveTitle(har) });
  return { spec: toYaml(doc), warnings };
}

function deriveTitle(har: unknown): string {
  const log = (har as HarFile)?.log;
  const title = log?.title;
  const creator = log?.creator?.name;
  return (typeof title === "string" && title) || creator || "API";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run format:fix && node --test src/scripts/har-openapi/generate.test.ts && npm run test:scripts`
Expected: PASS (3 generate tests; full suite includes all prior tests)

---

### Task 8: HarToOpenApi component

**Files:**
- Create: `src/components/HarToOpenApi.astro`

**Interfaces:**
- Consumes: `generateOpenApi` from `../scripts/har-openapi/generate.ts`
- Produces (consumed by Task 9): a component rendered via `<HarToOpenApi />`

- [ ] **Step 1: Write the component**

Create `src/components/HarToOpenApi.astro`:

```astro
---
---

<div class="app">
  <label class="field">
    <span>HAR JSON</span>
    <textarea id="hto-input" class="tall" spellcheck="false" placeholder={'Paste a HAR export here. It must contain log.entries with request.url, request.method, and response.status.'}></textarea>
  </label>

  <div class="toolbar">
    <button id="hto-convert" class="primary" type="button">Convert</button>
    <button id="hto-copy" class="secondary" type="button">Copy</button>
  </div>

  <p id="hto-warnings" class="warn" hidden></p>
  <p id="hto-error" class="error" hidden></p>
  <pre id="hto-output" class="output">Paste a HAR file and click Convert.</pre>
</div>

<script>
  import { generateOpenApi } from "../scripts/har-openapi/generate.ts";

  const input = document.querySelector<HTMLTextAreaElement>("#hto-input")!;
  const convert = document.querySelector<HTMLButtonElement>("#hto-convert")!;
  const copy = document.querySelector<HTMLButtonElement>("#hto-copy")!;
  const output = document.querySelector<HTMLPreElement>("#hto-output")!;
  const error = document.querySelector<HTMLElement>("#hto-error")!;
  const warnings = document.querySelector<HTMLElement>("#hto-warnings")!;

  function render() {
    const text = input.value.trim();
    if (!text) {
      output.textContent = "Paste a HAR file and click Convert.";
      error.hidden = true;
      warnings.hidden = true;
      return;
    }
    try {
      const result = generateOpenApi(text);
      output.textContent = result.spec;
      error.hidden = true;
      if (result.warnings.length) {
        warnings.textContent = "Warnings: " + result.warnings.join(" | ");
        warnings.hidden = false;
      } else {
        warnings.hidden = true;
      }
    } catch (err) {
      output.textContent = "Fix the error above to see generated code.";
      error.textContent = err instanceof Error ? err.message : String(err);
      error.hidden = false;
      warnings.hidden = true;
    }
  }

  convert.addEventListener("click", render);
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") render();
  });

  copy.addEventListener("click", async () => {
    const label = copy.textContent;
    try {
      await navigator.clipboard.writeText(output.textContent ?? "");
      copy.textContent = "Copied!";
    } catch {
      copy.textContent = label;
    }
    window.setTimeout(() => {
      copy.textContent = label;
    }, 1500);
  });

  render();
</script>
```

- [ ] **Step 2: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds (15 pages; the page that uses the component comes in Task 9).

---

### Task 9: HAR to OpenAPI page

**Files:**
- Create: `src/content/docs/Tools/har-to-openapi.mdx`

**Interfaces:**
- Consumes: `<HarToOpenApi />` from `../../../components/HarToOpenApi.astro` (Task 8)

- [ ] **Step 1: Write the page**

Create `src/content/docs/Tools/har-to-openapi.mdx`:

```mdx
---
title: HAR to OpenAPI
description: Convert HTTP Archive (HAR) exports into an OpenAPI 3.0.3 spec in YAML, right in your browser.
icon: seti:code-search
---

import HarToOpenApi from '../../../components/HarToOpenApi.astro';

Paste a HAR export below and click Convert to generate an OpenAPI 3.0.3 spec in YAML. The tool infers request and response schemas from captured JSON bodies, templates concrete IDs like `/users/123` into `{id}` path parameters, merges repeated calls into single operations, and emits a `basicAuth` security scheme when requests carried `Authorization: Basic` headers. Everything runs in your browser; nothing is uploaded.

<HarToOpenApi />

Query parameters become `query` parameters, JSON request bodies become `requestBody` schemas, and each observed response status becomes a `responses` entry with its schema. Schema shapes are merged across repeated calls, and fields present in every object are marked required.
```

- [ ] **Step 2: Verify the page builds**

Run: `npm run build`
Expected: build succeeds; `dist/tools/har-to-openapi/index.html` exists and contains `id="hto-input"`.

---

### Task 10: AGENTS.md note + full verification

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

In the **Architecture & Content** bullet list, change the **Client-Side Web Apps** bullet (AGENTS.md line 23) to include the new app:

Replace:

```markdown
- **Client-Side Web Apps:** `Tools/json-to-code` and `Tools/curl-to-code` embed fully client-side code generators (`JsonToCode.astro`, `CurlToCode.astro`). Their engines live as pure TypeScript modules in `src/scripts/` and are tested with Node's built-in runner via `npm run test:scripts` (no external test framework).
```

with:

```markdown
- **Client-Side Web Apps:** `Tools/json-to-code`, `Tools/curl-to-code`, and `Tools/har-to-openapi` embed fully client-side generators (`JsonToCode.astro`, `CurlToCode.astro`, `HarToOpenApi.astro`). Their engines live as pure TypeScript modules in `src/scripts/` and are tested with Node's built-in runner via `npm run test:scripts` (no external test framework).
```

- [ ] **Step 2: Run the full verification suite**

Run:

```bash
npm run format:fix && npm run test:scripts && npm run build && npm run format:check
```

Expected:
- `test:scripts` passes (all existing tests + the new har-openapi tests).
- Build succeeds (16 pages).
- `format:check` prints "All matched files use Prettier code style!".

- [ ] **Step 3: Spot-check the built page**

Run: `rg -l 'hto-input' dist/tools/har-to-openapi/index.html`
Expected: returns the page HTML file.

- [ ] **Step 4: (Optional, manual QA)** Run `npm run dev`, open `http://localhost:4321/tools/har-to-openapi/`, paste a HAR export (e.g. from Chrome DevTools), confirm the YAML spec renders and Copy works; toggle dark/light theme and confirm the styling matches the other tools.
