# Client-Side Code Generators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two Starlight docs pages under `Tools/` — "JSON to Code" (quicktype-style) and "cURL to Code" — each embedding a fully client-side web app built from hand-rolled TypeScript engines.

**Architecture:** Each app is a self-contained `.astro` component whose bundled `<script>` imports pure TypeScript engine modules from `src/scripts/`. Engine modules are plain ESM `.ts` files with no DOM access (testable via Node's built-in `node:test`). MDX pages import the components exactly like `index.mdx` imports `SiteToc.astro`.

**Tech Stack:** Astro 7, Starlight 0.41, vanilla TypeScript, Node 26 built-in test runner (`node --test`, no new dependencies).

## Global Constraints

- **No new npm dependencies.** Runtime deps are only `astro` and `@astrojs/starlight`. Tests use Node's built-in `node --test` runner (type stripping, no framework).
- **No backend, no CDN, no SSR.** Everything runs in the browser from static files.
- **Content width only.** Apps must fit inside the default 45rem Starlight content column. Do NOT use `template: 'splash'`.
- **No commits.** Per AGENTS.md, do NOT stage, commit, or push anything unless the user explicitly asks.
- **Explicit `.ts` extensions in all relative imports** between script modules (required by Node's ESM type stripping; Vite handles them too).
- **No comments in generated code output.** Generated snippets must be clean.
- **Frontmatter per `src/content/docs/Tools/Git.md`:** `title`, `description`, `icon`.
- **Formatting:** run `npm run format:fix` before finishing. CI runs `format:check` over `src/**/*.{md,css,ts}` (`.astro` files are intentionally not formatted — no prettier astro plugin installed).
- **Module scope conventions (per `node --test`):** test files named `*.test.ts` colocated in `src/scripts/`, importing with `import { test } from "node:test"` and `import { strict as assert } from "node:assert"`.

## File Structure

- `package.json` — add `test:scripts` script (modify)
- `src/scripts/json-code/ast.ts` — type AST + JSON inference (create)
- `src/scripts/json-code/names.ts` — naming/identifier helpers (create)
- `src/scripts/json-code/tsgen.ts` — TypeScript generator (create)
- `src/scripts/json-code/gogen.ts` — Go generator (create)
- `src/scripts/json-code/pygen.ts` — Python generator (create)
- `src/scripts/json-code/rustgen.ts` — Rust generator (create)
- `src/scripts/json-code/jsongen.ts` — JSON Schema generator (create)
- `src/scripts/json-code/generate.ts` — json orchestrator `generateCode(json, target, rootName)` (create)
- `src/scripts/curl-code/parser.ts` — curl tokenizer/parser → `CurlRequest` (create)
- `src/scripts/curl-code/fetchgen.ts` — JS/TS fetch generator (create)
- `src/scripts/curl-code/gogen.ts` — Go generator (create)
- `src/scripts/curl-code/rustgen.ts` — Rust reqwest generator (create)
- `src/scripts/curl-code/pygen.ts` — Python requests generator (create)
- `src/scripts/curl-code/psgen.ts` — PowerShell generator (create)
- `src/scripts/curl-code/generate.ts` — curl orchestrator `generateCode(curl, target) → { code, warnings }` (create)
- `src/components/JsonToCode.astro` — JSON app UI (create)
- `src/components/CurlToCode.astro` — curl app UI (create)
- `src/content/docs/Tools/json-to-code.mdx` (create)
- `src/content/docs/Tools/curl-to-code.mdx` (create)
- `AGENTS.md` — document new content + test command (modify)

Each engine task ends by running its `node --test` test file. Component/page tasks end by running `npm run build`.

---

### Task 1: Test runner script + JSON type AST & inference

**Files:**
- Modify: `package.json`
- Create: `src/scripts/json-code/ast.ts`
- Test: `src/scripts/json-code/ast.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2-8):
  - `interface Field { type: JsonType; nullable: boolean; required: boolean }`
  - `type JsonType = { kind: "string" } | { kind: "number" } | { kind: "boolean" } | { kind: "any" } | { kind: "null" } | { kind: "array"; items: Field } | { kind: "object"; fields: Map<string, Field>; name?: string }`
  - `inferType(value: unknown): Field`
  - `mergeFields(a: Field, b: Field): Field`

- [ ] **Step 1: Add `test:scripts` to `package.json`**

Change the `scripts` block to add one line:

```json
    "format:fix": "prettier --write \"src/**/*.{md,css,ts}\" \"astro.config.mjs\"",
    "test:scripts": "node --test \"src/scripts/**/*.test.ts\""
```

- [ ] **Step 2: Write the failing test**

Create `src/scripts/json-code/ast.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType, mergeFields } from "./ast.ts";

test("infers scalar fields", () => {
  const f = inferType({ name: "Jane", age: 30, active: true });
  assert.equal(f.type.kind, "object");
  if (f.type.kind !== "object") return;
  assert.equal(f.type.fields.get("name")?.type.kind, "string");
  assert.equal(f.type.fields.get("age")?.type.kind, "number");
  assert.equal(f.type.fields.get("active")?.type.kind, "boolean");
});

test("marks null values as nullable", () => {
  const f = inferType({ a: null, b: "x" });
  if (f.type.kind !== "object") throw new Error("expected object");
  assert.equal(f.type.fields.get("a")?.nullable, true);
  assert.equal(f.type.fields.get("a")?.type.kind, "any");
  assert.equal(f.type.fields.get("b")?.nullable, false);
});

test("merges array element objects", () => {
  const f = inferType([
    { id: 1, name: "a" },
    { id: 2, name: "b", extra: true },
  ]);
  if (f.type.kind !== "array") throw new Error("expected array");
  const item = f.type.items;
  assert.equal(item.nullable, false);
  if (item.type.kind !== "object") throw new Error("expected object");
  assert.equal(item.type.fields.size, 3);
  assert.equal(item.type.fields.get("id")?.type.kind, "number");
  assert.equal(item.type.fields.get("extra")?.nullable, false);
  assert.equal(item.type.fields.get("extra")?.required, false);
});

test("heterogeneous array items collapse to any", () => {
  const f = inferType([1, "x"]);
  if (f.type.kind !== "array") throw new Error("expected array");
  assert.equal(f.type.items.type.kind, "any");
});

test("nested object fields infer recursively", () => {
  const f = inferType({ meta: { tags: ["a", "b"] } });
  if (f.type.kind !== "object") throw new Error("expected object");
  const meta = f.type.fields.get("meta");
  if (!meta || meta.type.kind !== "object") throw new Error("expected nested object");
  const tags = meta.type.fields.get("tags");
  if (!tags || tags.type.kind !== "array") throw new Error("expected array");
  assert.equal(tags.type.items.type.kind, "string");
});

test("mergeFields unions nullability", () => {
  const a = inferType("x");
  const b = inferType(null);
  const merged = mergeFields(a, b);
  assert.equal(merged.nullable, true);
  assert.equal(merged.type.kind, "string");
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test src/scripts/json-code/ast.test.ts`
Expected: FAIL — `Cannot find module './ast.ts'`

- [ ] **Step 4: Implement `ast.ts`**

Create `src/scripts/json-code/ast.ts`:

```ts
export interface Field {
  type: JsonType;
  nullable: boolean;
  required: boolean;
}

export type JsonType =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "any" }
  | { kind: "null" }
  | { kind: "array"; items: Field }
  | { kind: "object"; fields: Map<string, Field>; name?: string };

export function inferType(value: unknown): Field {
  if (value === null) {
    return { type: { kind: "any" }, nullable: true, required: true };
  }
  return { type: inferNonNull(value), nullable: false, required: true };
}

function inferNonNull(value: unknown): JsonType {
  if (typeof value === "string") return { kind: "string" };
  if (typeof value === "number") return { kind: "number" };
  if (typeof value === "boolean") return { kind: "boolean" };
  if (Array.isArray(value)) {
    let items: Field = { type: { kind: "any" }, nullable: false, required: true };
    for (const el of value) items = mergeFields(items, inferType(el));
    return { kind: "array", items };
  }
  if (typeof value === "object") {
    const fields = new Map<string, Field>();
    for (const [key, val] of Object.entries(value)) fields.set(key, inferType(val));
    return { kind: "object", fields };
  }
  return { kind: "any" };
}

export function mergeFields(a: Field, b: Field): Field {
  return {
    type: mergeTypes(a.type, b.type),
    nullable: a.nullable || b.nullable,
    required: a.required && b.required,
  };
}

function mergeTypes(a: JsonType, b: JsonType): JsonType {
  if (a.kind === "any") return b.kind === "any" ? a : b;
  if (b.kind === "any") return a;
  if (a.kind === "null") return b;
  if (b.kind === "null") return a;
  if (a.kind !== b.kind) return { kind: "any" };
  if (a.kind === "array" && b.kind === "array") {
    return { kind: "array", items: mergeFields(a.items, b.items) };
  }
  if (a.kind === "object" && b.kind === "object") {
    return { kind: "object", fields: mergeMaps(a.fields, b.fields) };
  }
  return a;
}

function mergeMaps(a: Map<string, Field>, b: Map<string, Field>): Map<string, Field> {
  const out = new Map<string, Field>();
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) {
    const fa = a.get(key);
    const fb = b.get(key);
    if (fa && fb) out.set(key, mergeFields(fa, fb));
    else if (fa) out.set(key, { ...fa, required: false });
    else if (fb) out.set(key, { ...fb, required: false });
  }
  return out;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `node --test src/scripts/json-code/ast.test.ts`
Expected: PASS (6 tests)

---

### Task 2: Identifier/naming helpers

**Files:**
- Create: `src/scripts/json-code/names.ts`
- Test: `src/scripts/json-code/names.test.ts`

**Interfaces:**
- Consumes: `Field`, `JsonType` from `./ast.ts`
- Produces (consumed by Tasks 3-8):
  - `pascalCase(s: string): string`
  - `snakeCase(s: string): string`
  - `tsIdent(s: string): string`
  - `pyIdent(s: string): string`
  - `rustIdent(s: string): string`
  - `collectObjects(root: Field, rootName: string): { root: NamedType | null; all: NamedType[] }`
  - `interface NamedType { name: string; fields: Map<string, Field> }`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/names.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { collectObjects, pascalCase, pyIdent, rustIdent, snakeCase, tsIdent } from "./names.ts";

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/names.test.ts`
Expected: FAIL — `Cannot find module './names.ts'`

- [ ] **Step 3: Implement `names.ts`**

Create `src/scripts/json-code/names.ts`:

```ts
import type { Field, JsonType } from "./ast.ts";

export interface NamedType {
  name: string;
  fields: Map<string, Field>;
}

export function pascalCase(s: string): string {
  const words = s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "Type";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

export function snakeCase(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1];
    const next = s[i + 1];
    if (out.length > 0) {
      const prevLower = /[a-z0-9]/.test(prev);
      const isUpper = /[A-Z]/.test(c);
      const nextLower = /[a-z]/.test(next ?? "");
      if ((prevLower && isUpper) || (isUpper && /[A-Z]/.test(prev) && nextLower)) {
        out += "_";
      }
    }
    out += c;
  }
  return out.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}

export function tsIdent(s: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) ? s : JSON.stringify(s);
}

export function pyIdent(s: string): string {
  const out = s.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(out) ? out : `field_${out}`;
}

const RUST_KEYWORDS = new Set([
  "as", "break", "const", "continue", "crate", "else", "enum", "extern",
  "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
  "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct",
  "super", "trait", "true", "type", "unsafe", "use", "where", "while",
  "async", "await", "dyn",
]);

export function rustIdent(s: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(s) && !RUST_KEYWORDS.has(s)) return s;
  const out = snakeCase(s);
  return /^[a-z_][a-z0-9_]*$/.test(out) && !RUST_KEYWORDS.has(out) ? out : `_${out}`;
}

export function collectObjects(
  root: Field,
  rootName: string,
): { root: NamedType | null; all: NamedType[] } {
  const all = new Map<string, NamedType>();
  const walk = (field: Field, suggested: string): string | null => {
    const t = field.type;
    if (t.kind === "array") return walk(t.items, suggested);
    if (t.kind !== "object") return null;
    let name = suggested;
    const existing = all.get(name);
    if (existing && existing.fields !== t.fields) {
      let n = 1;
      while (all.has(`${name}${n}`)) n++;
      name = `${name}${n}`;
    }
    if (!all.has(name)) {
      all.set(name, { name, fields: t.fields });
      t.name = name;
      for (const [key, f] of t.fields) walk(f, pascalCase(key));
    }
    return name;
  };
  const used = walk(root, rootName);
  return { root: used ? (all.get(used) ?? null) : null, all: [...all.values()] };
}
```

Note: `snakeCase` uses a character scan rather than regex pairs so that acronym prefixes like `HTTPCode` become `http_code` (a naive `([A-Z]+)([A-Z][a-z])` regex turns it into `http_coode`). Underscores are inserted on lower→upper transitions and before an upper letter that follows another upper and precedes a lower.

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/names.test.ts`
Expected: PASS (5 tests)

---

### Task 3: TypeScript generator

**Files:**
- Create: `src/scripts/json-code/tsgen.ts`
- Test: `src/scripts/json-code/tsgen.test.ts`

**Interfaces:**
- Consumes: `Field`/`JsonType` from `./ast.ts`; `collectObjects`, `tsIdent` from `./names.ts`
- Produces (consumed by Task 8): `generateTypeScript(root: Field, rootName: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/tsgen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateTypeScript } from "./tsgen.ts";

test("generates interfaces with named nested types", () => {
  const root = inferType({
    name: "Jane",
    age: 30,
    nick: null,
    tags: ["a"],
    address: { street: "1 Main St" },
    "my-key": true,
  });
  const out = generateTypeScript(root, "User");
  assert.ok(out.includes("export interface User {"));
  assert.ok(out.includes("  age: number;"));
  assert.ok(out.includes("  nick: (unknown | null);"));
  assert.ok(out.includes("  tags: string[];"));
  assert.ok(out.includes("  address: Address;"));
  assert.ok(out.includes('  "my-key": boolean;'));
  assert.ok(out.includes("export interface Address {"));
  assert.ok(out.includes("  street: string;"));
});

test("marks fields absent in some objects as optional", () => {
  const root = inferType([{ a: 1 }, { a: 2, b: "x" }]);
  const out = generateTypeScript(root, "Row");
  assert.ok(out.includes("  a: number;"));
  assert.ok(out.includes("  b?: string;"));
});

test("nullable array elements", () => {
  const root = inferType({ xs: [1, null] });
  const out = generateTypeScript(root, "Root");
  assert.ok(out.includes("  xs: (number | null)[];"));
});

test("scalar top-level input emits a type alias", () => {
  const out = generateTypeScript(inferType(42), "Root");
  assert.equal(out, "export type Root = number;\n");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/tsgen.test.ts`
Expected: FAIL — `Cannot find module './tsgen.ts'`

- [ ] **Step 3: Implement `tsgen.ts`**

Create `src/scripts/json-code/tsgen.ts`:

```ts
import type { Field, JsonType } from "./ast.ts";
import { collectObjects, tsIdent } from "./names.ts";

export function generateTypeScript(root: Field, rootName: string): string {
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) return `export type ${rootName} = ${tsType(root)};\n`;
  const lines: string[] = [];
  for (const t of all) {
    lines.push(`export interface ${t.name} {`);
    for (const [key, field] of t.fields) {
      const opt = field.required ? "" : "?";
      lines.push(`  ${tsIdent(key)}${opt}: ${tsType(field)};`);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

function tsType(field: Field): string {
  const t = field.type;
  let base: string;
  if (t.kind === "object") base = t.name ?? "Record<string, unknown>";
  else if (t.kind === "array") base = tsType(t.items);
  else base = scalar(t);
  if (field.nullable) base = `(${base} | null)`;
  return t.kind === "array" ? `${base}[]` : base;
}

function scalar(t: JsonType): string {
  switch (t.kind) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "any": return "unknown";
    case "null": return "null";
    default: return "unknown";
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/tsgen.test.ts`
Expected: PASS (4 tests)

---

### Task 4: Go generator

**Files:**
- Create: `src/scripts/json-code/gogen.ts`
- Test: `src/scripts/json-code/gogen.test.ts`

**Interfaces:**
- Consumes: `Field`/`JsonType` from `./ast.ts`; `collectObjects`, `pascalCase` from `./names.ts`
- Produces (consumed by Task 8): `generateGo(root: Field, rootName: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/gogen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateGo } from "./gogen.ts";

test("generates structs with json tags", () => {
  const root = inferType([
    { userName: "Jane", age: null, tags: ["a"], nested: { ok: true } },
    { userName: "Bob", age: 30, tags: [], nested: { ok: false } },
  ]);
  const out = generateGo(root, "User");
  assert.ok(out.includes("type User struct {"));
  assert.ok(out.includes("UserName string `json:\"userName\"`"));
  assert.ok(out.includes("*float64 `json:\"age\"`"));
  assert.ok(out.includes("[]string `json:\"tags\"`"));
  assert.ok(out.includes("Nested `json:\"nested\"`"));
  assert.ok(out.includes("type Nested struct {"));
  assert.ok(out.includes("Ok bool `json:\"ok\"`"));
});

test("scalar top-level input emits a type alias", () => {
  const out = generateGo(inferType("hi"), "Root");
  assert.equal(out, "type Root string\n");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/gogen.test.ts`
Expected: FAIL — `Cannot find module './gogen.ts'`

- [ ] **Step 3: Implement `gogen.ts`**

Create `src/scripts/json-code/gogen.ts`:

```ts
import type { Field, JsonType } from "./ast.ts";
import { collectObjects, pascalCase } from "./names.ts";

export function generateGo(root: Field, rootName: string): string {
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) return `type ${rootName} ${goType(root)}\n`;
  const lines: string[] = ["package main", ""];
  for (const t of all) {
    lines.push(`type ${t.name} struct {`);
    for (const [key, field] of t.fields) {
      lines.push(`\t${pascalCase(key)} ${goType(field)} \`json:"${key}"\``);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

function goType(field: Field): string {
  const t = field.type;
  let base: string;
  switch (t.kind) {
    case "object": base = t.name ?? "map[string]interface{}"; break;
    case "array": base = `[]${goType(t.items)}`; break;
    case "string": base = "string"; break;
    case "number": base = "float64"; break;
    case "boolean": base = "bool"; break;
    default: base = "interface{}";
  }
  return field.nullable ? `*${base}` : base;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/gogen.test.ts`
Expected: PASS (2 tests)

---

### Task 5: Python generator

**Files:**
- Create: `src/scripts/json-code/pygen.ts`
- Test: `src/scripts/json-code/pygen.test.ts`

**Interfaces:**
- Consumes: `Field`/`JsonType` from `./ast.ts`; `collectObjects`, `pyIdent` from `./names.ts`
- Produces (consumed by Task 8): `generatePython(root: Field, rootName: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/pygen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generatePython } from "./pygen.ts";

test("generates dataclasses with Optional and list", () => {
  const root = inferType({ name: "Jane", age: null, tags: ["a"], meta: { ok: true } });
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

test("required fields come before defaulted fields", () => {
  const root = inferType([{ a: 1, b: "x" }, { a: 2 }]);
  const out = generatePython(root, "Row");
  const idxA = out.indexOf("    a: float");
  const idxB = out.indexOf("    b: Optional[str] = None");
  assert.ok(idxA >= 0 && idxB > idxA);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/pygen.test.ts`
Expected: FAIL — `Cannot find module './pygen.ts'`

- [ ] **Step 3: Implement `pygen.ts`**

Create `src/scripts/json-code/pygen.ts`:

```ts
import type { Field, JsonType } from "./ast.ts";
import { collectObjects, pyIdent } from "./names.ts";

export function generatePython(root: Field, rootName: string): string {
  const header = [
    "from __future__ import annotations",
    "from dataclasses import dataclass",
    "from typing import Any, Optional",
    "",
  ];
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) return [...header, `${rootName} = ${pyType(root)}`, ""].join("\n");
  const lines = [...header];
  for (const t of all) {
    lines.push("@dataclass", `class ${t.name}:`);
    const withoutDefault: string[] = [];
    const withDefault: string[] = [];
    for (const [key, field] of t.fields) {
      const defaultable = field.nullable || !field.required;
      const line = defaultable
        ? `    ${pyIdent(key)}: ${pyType(field)} = None`
        : `    ${pyIdent(key)}: ${pyType(field)}`;
      (defaultable ? withDefault : withoutDefault).push(line);
    }
    lines.push(...withoutDefault, ...withDefault, "");
  }
  return lines.join("\n");
}

function pyType(field: Field): string {
  const t = field.type;
  let base: string;
  switch (t.kind) {
    case "object": base = t.name ?? "Any"; break;
    case "array": base = `list[${pyType(t.items)}]`; break;
    case "string": base = "str"; break;
    case "number": base = "float"; break;
    case "boolean": base = "bool"; break;
    default: base = "Any";
  }
  return field.nullable || !field.required ? `Optional[${base}]` : base;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/pygen.test.ts`
Expected: PASS (2 tests)

---

### Task 6: Rust generator

**Files:**
- Create: `src/scripts/json-code/rustgen.ts`
- Test: `src/scripts/json-code/rustgen.test.ts`

**Interfaces:**
- Consumes: `Field`/`JsonType` from `./ast.ts`; `collectObjects`, `rustIdent` from `./names.ts`
- Produces (consumed by Task 8): `generateRust(root: Field, rootName: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/rustgen.test.ts`:

```ts
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
  assert.equal(out, "use serde::{Deserialize, Serialize};\n\npub type Root = bool;\n");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/rustgen.test.ts`
Expected: FAIL — `Cannot find module './rustgen.ts'`

- [ ] **Step 3: Implement `rustgen.ts`**

Create `src/scripts/json-code/rustgen.ts`:

```ts
import type { Field, JsonType } from "./ast.ts";
import { collectObjects, rustIdent } from "./names.ts";

export function generateRust(root: Field, rootName: string): string {
  const header = "use serde::{Deserialize, Serialize};";
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) return `${header}\n\npub type ${rootName} = ${rustType(root)};\n`;
  const lines = [header, ""];
  for (const t of all) {
    lines.push("#[derive(Serialize, Deserialize, Debug)]", `pub struct ${t.name} {`);
    for (const [key, field] of t.fields) {
      const ident = rustIdent(key);
      if (ident !== key) lines.push(`    #[serde(rename = "${key}")]`);
      lines.push(`    pub ${ident}: ${rustType(field)},`);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

function rustType(field: Field): string {
  const t = field.type;
  let base: string;
  switch (t.kind) {
    case "object": base = t.name ?? "serde_json::Value"; break;
    case "array": base = `Vec<${rustType(t.items)}>`; break;
    case "string": base = "String"; break;
    case "number": base = "f64"; break;
    case "boolean": base = "bool"; break;
    default: base = "serde_json::Value";
  }
  return field.nullable ? `Option<${base}>` : base;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/rustgen.test.ts`
Expected: PASS (2 tests)

---

### Task 7: JSON Schema generator

**Files:**
- Create: `src/scripts/json-code/jsongen.ts`
- Test: `src/scripts/json-code/jsongen.test.ts`

**Interfaces:**
- Consumes: `Field`/`JsonType` from `./ast.ts`; `collectObjects` from `./names.ts`
- Produces (consumed by Task 8): `generateJsonSchema(root: Field, rootName: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/jsongen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inferType } from "./ast.ts";
import { generateJsonSchema } from "./jsongen.ts";

test("generates draft-07 schema with definitions", () => {
  const root = inferType([
    { id: 1, name: "a", age: null, tags: ["x"], meta: { ok: true } },
    { id: 2, name: "b", age: 30, tags: [], meta: { ok: false } },
  ]);
  const schema = JSON.parse(generateJsonSchema(root, "User"));
  assert.equal(schema.$ref, "#/definitions/User");
  assert.equal(schema.definitions.User.properties.id.type, "number");
  assert.deepEqual(schema.definitions.User.properties.age.type, ["number", "null"]);
  assert.equal(schema.definitions.User.properties.tags.type, "array");
  assert.equal(schema.definitions.User.properties.meta.$ref, "#/definitions/Meta");
  assert.deepEqual(schema.definitions.User.required, ["id", "name", "age", "tags", "meta"]);
  assert.equal(schema.definitions.User.additionalProperties, false);
});

test("marks only universally-present keys required", () => {
  const root = inferType([{ a: 1 }, { a: 2, b: "x" }]);
  const schema = JSON.parse(generateJsonSchema(root, "Row"));
  assert.deepEqual(schema.definitions.Row.required, ["a"]);
});

test("scalar top-level input emits inline schema", () => {
  const schema = JSON.parse(generateJsonSchema(inferType(42), "Root"));
  assert.equal(schema.type, "number");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/jsongen.test.ts`
Expected: FAIL — `Cannot find module './jsongen.ts'`

- [ ] **Step 3: Implement `jsongen.ts`**

Create `src/scripts/json-code/jsongen.ts`:

```ts
import type { Field, JsonType } from "./ast.ts";
import { collectObjects } from "./names.ts";

const SCHEMA_URL = "http://json-schema.org/draft-07/schema#";

export function generateJsonSchema(root: Field, rootName: string): string {
  const { root: rootType, all } = collectObjects(root, rootName);
  if (!rootType) {
    return JSON.stringify({ $schema: SCHEMA_URL, ...fieldSchema(root) }, null, 2);
  }
  const definitions: Record<string, unknown> = {};
  for (const t of all) definitions[t.name] = objectSchema(t.fields);
  const schema = {
    $schema: SCHEMA_URL,
    $ref: `#/definitions/${rootType.name}`,
    definitions,
  };
  return JSON.stringify(schema, null, 2);
}

function objectSchema(fields: Map<string, Field>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of fields) {
    properties[key] = fieldSchema(field);
    if (field.required) required.push(key);
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  };
}

function fieldSchema(field: Field): Record<string, unknown> {
  const schema = baseSchema(field.type);
  if (field.nullable && "type" in schema) {
    const type = Array.isArray(schema.type) ? schema.type : [schema.type];
    return { ...schema, type: [...type, "null"] };
  }
  return schema;
}

function baseSchema(t: JsonType): Record<string, unknown> {
  switch (t.kind) {
    case "string": return { type: "string" };
    case "number": return { type: "number" };
    case "boolean": return { type: "boolean" };
    case "null": return { type: "null" };
    case "any": return {};
    case "array": return { type: "array", items: fieldSchema(t.items) };
    case "object": return { $ref: `#/definitions/${t.name}` };
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/jsongen.test.ts`
Expected: PASS (3 tests)

---

### Task 8: JSON orchestrator + integration test

**Files:**
- Create: `src/scripts/json-code/generate.ts`
- Test: `src/scripts/json-code/generate.test.ts`

**Interfaces:**
- Consumes: `inferType` from `./ast.ts`; generators from Tasks 3-7; `pascalCase` from `./names.ts`
- Produces (consumed by Task 9): `type Target = "typescript" | "go" | "python" | "rust" | "json-schema"`, `generateCode(json: string, target: Target, rootName: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/json-code/generate.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateCode } from "./generate.ts";

const SAMPLE = JSON.stringify({
  id: 1,
  name: "Jane",
  tags: ["a", "b"],
  meta: { ok: true },
});

test("typescript target", () => {
  assert.ok(generateCode(SAMPLE, "typescript", "User").includes("export interface User {"));
});

test("go target", () => {
  assert.ok(generateCode(SAMPLE, "go", "User").includes("type User struct {"));
});

test("python target", () => {
  assert.ok(generateCode(SAMPLE, "python", "User").includes("class User:"));
});

test("rust target", () => {
  assert.ok(generateCode(SAMPLE, "rust", "User").includes("pub struct User {"));
});

test("json-schema target", () => {
  assert.ok(generateCode(SAMPLE, "json-schema", "User").includes("#/definitions/User"));
});

test("invalid JSON throws", () => {
  assert.throws(() => generateCode("{nope", "typescript", "User"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/json-code/generate.test.ts`
Expected: FAIL — `Cannot find module './generate.ts'`

- [ ] **Step 3: Implement `generate.ts`**

Create `src/scripts/json-code/generate.ts`:

```ts
import { inferType } from "./ast.ts";
import { generateGo } from "./gogen.ts";
import { generateJsonSchema } from "./jsongen.ts";
import { pascalCase } from "./names.ts";
import { generatePython } from "./pygen.ts";
import { generateRust } from "./rustgen.ts";
import { generateTypeScript } from "./tsgen.ts";

export type Target = "typescript" | "go" | "python" | "rust" | "json-schema";

export function generateCode(json: string, target: Target, rootName: string): string {
  const root = inferType(JSON.parse(json));
  const name = pascalCase(rootName) || "Root";
  switch (target) {
    case "typescript": return generateTypeScript(root, name);
    case "go": return generateGo(root, name);
    case "python": return generatePython(root, name);
    case "rust": return generateRust(root, name);
    case "json-schema": return generateJsonSchema(root, name);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/json-code/generate.test.ts`
Expected: PASS (6 tests)

---

### Task 9: JsonToCode component

**Files:**
- Create: `src/components/JsonToCode.astro`

**Interfaces:**
- Consumes: `generateCode`, `Target` from `../scripts/json-code/generate.ts`
- Produces (consumed by Task 10): a component rendered via `<JsonToCode />`

- [ ] **Step 1: Write the component**

Create `src/components/JsonToCode.astro`:

```astro
---
---

<div class="app">
  <label class="field">
    <span>JSON sample</span>
    <textarea id="j2c-input" spellcheck="false" placeholder={'{"name":"Jane","age":30,"active":true,"tags":["a"],"meta":{"ok":true}}'}></textarea>
  </label>

  <div class="toolbar">
    <select id="j2c-target" aria-label="Target language">
      <option value="typescript">TypeScript</option>
      <option value="go">Go</option>
      <option value="python">Python</option>
      <option value="rust">Rust</option>
      <option value="json-schema">JSON Schema</option>
    </select>
    <input id="j2c-root" type="text" value="Root" aria-label="Root type name" />
    <button id="j2c-copy" type="button">Copy</button>
  </div>

  <p id="j2c-error" class="error" hidden></p>
  <pre id="j2c-output" class="output">Paste JSON above to generate typed code.</pre>
</div>

<style>
  .app {
    width: 100%;
  }
  .app textarea,
  .app .output {
    width: 100%;
    box-sizing: border-box;
    margin: 0.5rem 0;
    padding: 0.75rem;
    border: 1px solid var(--sl-color-hairline);
    border-radius: 0.5rem;
    background: var(--sl-color-bg-inline-code);
    color: var(--sl-color-text);
    font-family: var(--__sl-font-mono);
    font-size: 0.875rem;
    line-height: 1.5;
    tab-size: 2;
  }
  .app textarea {
    min-height: 12rem;
    resize: vertical;
  }
  .app .output {
    overflow-x: auto;
    min-height: 8rem;
    white-space: pre;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .toolbar select,
  .toolbar input,
  .toolbar button {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--sl-color-hairline);
    border-radius: 0.375rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-text);
    font: inherit;
  }
  .toolbar button {
    background: var(--sl-color-accent);
    color: var(--sl-color-text-invert);
    cursor: pointer;
  }
  .toolbar input {
    flex: 1;
    min-width: 8rem;
  }
  .error {
    color: var(--sl-color-red);
    margin: 0.5rem 0;
  }
</style>

<script>
  import { generateCode } from "../scripts/json-code/generate.ts";
  import type { Target } from "../scripts/json-code/generate.ts";

  const input = document.querySelector<HTMLTextAreaElement>("#j2c-input")!;
  const target = document.querySelector<HTMLSelectElement>("#j2c-target")!;
  const root = document.querySelector<HTMLInputElement>("#j2c-root")!;
  const output = document.querySelector<HTMLPreElement>("#j2c-output")!;
  const error = document.querySelector<HTMLElement>("#j2c-error")!;
  const copy = document.querySelector<HTMLButtonElement>("#j2c-copy")!;

  function render() {
    const text = input.value.trim();
    if (!text) {
      output.textContent = "Paste JSON above to generate typed code.";
      error.hidden = true;
      return;
    }
    try {
      const code = generateCode(text, target.value as Target, root.value.trim() || "Root");
      output.textContent = code;
      error.hidden = true;
    } catch (err) {
      output.textContent = "Fix the error above to see generated code.";
      error.textContent = err instanceof Error ? err.message : String(err);
      error.hidden = false;
    }
  }

  let timer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(render, 200);
  });
  root.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(render, 200);
  });
  target.addEventListener("change", render);

  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(output.textContent ?? "");
    const label = copy.textContent;
    copy.textContent = "Copied!";
    window.setTimeout(() => {
      copy.textContent = label;
    }, 1500);
  });

  render();
</script>
```

- [ ] **Step 2: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds; `dist/tools/json-to-code/index.html` does NOT exist yet (page comes in Task 10), but the component compiles.

---

### Task 10: JSON to Code page

**Files:**
- Create: `src/content/docs/Tools/json-to-code.mdx`

**Interfaces:**
- Consumes: `<JsonToCode />` from `../../../components/JsonToCode.astro` (Task 9)

- [ ] **Step 1: Write the page**

Create `src/content/docs/Tools/json-to-code.mdx`:

```mdx
---
title: JSON to Code
description: Generate typed model code from JSON samples for TypeScript, Go, Python, Rust, or JSON Schema.
icon: seti:json
---

import JsonToCode from '../../../components/JsonToCode.astro';

Paste a JSON sample below and pick a target language. The tool infers a type model from the sample — nested objects, arrays, and nullable fields included — and renders it as idiomatic code for the chosen target. Everything runs in your browser; nothing is uploaded.

<JsonToCode />

Field names from the JSON are used as-is in TypeScript and Python. Go converts field names to PascalCase, and Rust to snake_case with a `#[serde(rename)]` attribute when the name differs. Keys present in every object are marked required; keys seen in only some objects are optional.
```

- [ ] **Step 2: Verify the page builds**

Run: `npm run build`
Expected: build succeeds; `dist/tools/json-to-code/index.html` exists and contains `id="j2c-input"`.

---

### Task 11: curl parser

**Files:**
- Create: `src/scripts/curl-code/parser.ts`
- Test: `src/scripts/curl-code/parser.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 12-17):
  - `interface CurlRequest { method: string; url: string; headers: Array<[string, string]>; body?: string; warnings: string[] }`
  - `parseCurl(command: string): CurlRequest` (throws `Error` if no URL found)
  - `isJsonBody(req: CurlRequest): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/parser.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isJsonBody, parseCurl } from "./parser.ts";

test("simple GET", () => {
  const req = parseCurl("curl https://api.example.com/users");
  assert.equal(req.method, "GET");
  assert.equal(req.url, "https://api.example.com/users");
  assert.equal(req.headers.length, 0);
  assert.equal(req.body, undefined);
});

test("POST with JSON body infers content type", () => {
  const req = parseCurl('curl -X POST https://api.example.com/users -H "X-Custom: 1" -d \'{"name":"Jane"}\'');
  assert.equal(req.method, "POST");
  assert.deepEqual(req.headers, [
    ["X-Custom", "1"],
    ["Content-Type", "application/json"],
  ]);
  assert.equal(req.body, '{"name":"Jane"}');
  assert.ok(isJsonBody(req));
});

test("form body gets form content type", () => {
  const req = parseCurl('curl -d "name=Jane&age=30" https://api.example.com/users');
  assert.equal(req.method, "POST");
  assert.deepEqual(req.headers, [["Content-Type", "application/x-www-form-urlencoded"]]);
  assert.ok(!isJsonBody(req));
});

test("explicit content-type header is not overridden", () => {
  const req = parseCurl('curl -d \'{"a":1}\' -H "Content-Type: application/vnd.api+json" https://x.com');
  assert.deepEqual(req.headers, [["Content-Type", "application/vnd.api+json"]]);
});

test("basic auth via -u", () => {
  const req = parseCurl("curl -u user:pass https://api.example.com");
  const auth = req.headers.find(([k]) => k === "Authorization");
  assert.ok(auth);
  assert.equal(auth[1], "Basic " + btoa("user:pass"));
});

test("data-raw and long flags", () => {
  const req = parseCurl('curl --request POST --data-raw "hello" https://api.example.com');
  assert.equal(req.method, "POST");
  assert.equal(req.body, "hello");
});

test("quotes are stripped", () => {
  const req = parseCurl(`curl "https://api.example.com/x" -H "Authorization: Bearer abc"`);
  assert.equal(req.url, "https://api.example.com/x");
  assert.deepEqual(req.headers, [["Authorization", "Bearer abc"]]);
});

test("unsupported -F produces a warning", () => {
  const req = parseCurl('curl -F "file=@a.txt" https://api.example.com/upload');
  assert.ok(req.warnings.some((w) => w.includes("-F")));
});

test("data referencing a file warns", () => {
  const req = parseCurl("curl -d @data.json https://api.example.com");
  assert.ok(req.warnings.some((w) => w.includes("@")));
});

test("no URL throws", () => {
  assert.throws(() => parseCurl("curl -X GET"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/parser.test.ts`
Expected: FAIL — `Cannot find module './parser.ts'`

- [ ] **Step 3: Implement `parser.ts`**

Create `src/scripts/curl-code/parser.ts`:

```ts
export interface CurlRequest {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body?: string;
  warnings: string[];
}

const LONG_VALUE = new Set([
  "--request",
  "--header",
  "--data",
  "--data-binary",
  "--data-raw",
  "--user",
  "--form",
]);
const SHORT_VALUE = new Set(["X", "H", "d", "u", "F"]);

export function parseCurl(command: string): CurlRequest {
  const tokens = tokenize(command);
  let url = "";
  let method = "";
  let body: string | undefined;
  const headers: Array<[string, string]> = [];
  const warnings: string[] = [];

  const handleValue = (flag: string, value: string) => {
    if (flag === "-X" || flag === "--request") {
      method = value.toUpperCase();
    } else if (flag === "-H" || flag === "--header") {
      const idx = value.indexOf(":");
      if (idx === -1) warnings.push(`Skipped malformed header: ${value}`);
      else headers.push([value.slice(0, idx).trim(), value.slice(idx + 1).trim()]);
    } else if (flag === "-d" || flag === "--data" || flag === "--data-binary" || flag === "--data-raw") {
      if (value.startsWith("@")) warnings.push('--data references a file ("@"): inlined literally');
      body = value;
    } else if (flag === "-u" || flag === "--user") {
      headers.push(["Authorization", "Basic " + btoa(value)]);
    } else if (flag === "-F" || flag === "--form") {
      warnings.push("-F multipart form data is not supported");
    }
  };

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const flag = eq >= 0 ? tok.slice(0, eq) : tok;
      if (LONG_VALUE.has(flag)) {
        const value = eq >= 0 ? tok.slice(eq + 1) : tokens[i + 1];
        if (value === undefined) break;
        if (eq < 0) i++;
        handleValue(flag, value);
      }
    } else if (tok.startsWith("-") && tok.length > 1) {
      const short = tok[1];
      if (SHORT_VALUE.has(short)) {
        const value = tok.length > 2 ? tok.slice(2) : tokens[i + 1];
        if (value === undefined) break;
        if (tok.length === 2) i++;
        handleValue("-" + short, value);
      }
    } else if (!url && tok.toLowerCase() !== "curl") {
      url = tok;
    }
    i++;
  }

  if (!url) throw new Error("No URL found in the curl command.");

  const hasJsonBody = body !== undefined && /^[{[]/.test(body.trim());
  const hasContentType = headers.some(([k]) => k.toLowerCase() === "content-type");
  if (body !== undefined && !hasContentType) {
    headers.push([
      "Content-Type",
      hasJsonBody ? "application/json" : "application/x-www-form-urlencoded",
    ]);
  }

  return {
    method: method || (body !== undefined ? "POST" : "GET"),
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
    warnings,
  };
}

export function isJsonBody(req: CurlRequest): boolean {
  return /^[{[]/.test((req.body ?? "").trim());
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (quote) {
      if (c === "\\" && quote === '"') {
        cur += input[i + 1] ?? "";
        i++;
      } else if (c === quote) {
        quote = null;
      } else {
        cur += c;
      }
    } else if (c === "'" || c === '"') {
      quote = c;
    } else if (/\s/.test(c)) {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
    } else if (c === "\\") {
      cur += input[i + 1] ?? "";
      i++;
    } else {
      cur += c;
    }
    i++;
  }
  if (cur) tokens.push(cur);
  return tokens;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/parser.test.ts`
Expected: PASS (10 tests)

---

### Task 12: JS/TS fetch generator

**Files:**
- Create: `src/scripts/curl-code/fetchgen.ts`
- Test: `src/scripts/curl-code/fetchgen.test.ts`

**Interfaces:**
- Consumes: `CurlRequest`, `isJsonBody` from `./parser.ts`
- Produces (consumed by Task 17): `generateFetch(req: CurlRequest): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/fetchgen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generateFetch } from "./fetchgen.ts";

test("simple GET", () => {
  const out = generateFetch(parseCurl("curl https://api.example.com/users"));
  assert.equal(out, 'fetch("https://api.example.com/users");\n');
});

test("POST JSON", () => {
  const req = parseCurl('curl -X POST https://api.example.com/users -d \'{"name":"Jane"}\'');
  const out = generateFetch(req);
  assert.ok(out.includes('method: "POST"'));
  assert.ok(out.includes('body: JSON.stringify({"name":"Jane"})'));
  assert.ok(out.includes('"Content-Type": "application/json"'));
});

test("POST form data", () => {
  const out = generateFetch(parseCurl('curl -d "name=Jane" https://api.example.com'));
  assert.ok(out.includes('body: "name=Jane"'));
  assert.ok(!out.includes("JSON.stringify"));
});

test("headers and basic auth", () => {
  const out = generateFetch(parseCurl("curl -u user:pass -H 'X-Custom: 1' https://api.example.com"));
  assert.ok(out.includes('"Authorization": "Basic'));
  assert.ok(out.includes('"X-Custom": "1"'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/fetchgen.test.ts`
Expected: FAIL — `Cannot find module './fetchgen.ts'`

- [ ] **Step 3: Implement `fetchgen.ts`**

Create `src/scripts/curl-code/fetchgen.ts`:

```ts
import { isJsonBody, type CurlRequest } from "./parser.ts";

export function generateFetch(req: CurlRequest): string {
  const opts: string[] = [];
  if (req.method !== "GET" || req.body !== undefined) {
    opts.push(`  method: ${JSON.stringify(req.method)},`);
  }
  if (req.headers.length) {
    const items = req.headers.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    opts.push("  headers: {\n" + items.join("\n") + "\n  },");
  }
  if (req.body !== undefined) {
    const body = isJsonBody(req)
      ? `JSON.stringify(${req.body})`
      : JSON.stringify(req.body);
    opts.push(`  body: ${body},`);
  }
  if (!opts.length) return `fetch(${JSON.stringify(req.url)});\n`;
  return `fetch(${JSON.stringify(req.url)}, {\n${opts.join("\n")}\n});\n`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/fetchgen.test.ts`
Expected: PASS (4 tests)

---

### Task 13: Go generator (curl)

**Files:**
- Create: `src/scripts/curl-code/gogen.ts`
- Test: `src/scripts/curl-code/gogen.test.ts`

**Interfaces:**
- Consumes: `CurlRequest` from `./parser.ts`
- Produces (consumed by Task 17): `generateGo(req: CurlRequest): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/gogen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generateGo } from "./gogen.ts";

test("generates http.NewRequest", () => {
  const req = parseCurl('curl -X POST https://api.example.com/users -H "X-Custom: 1" -d \'{"name":"Jane"}\'');
  const out = generateGo(req);
  assert.ok(out.includes('req, err := http.NewRequest("POST", "https://api.example.com/users", bytes.NewBufferString("{\\"name\\":\\"Jane\\"}"))'));
  assert.ok(out.includes('req.Header.Set("X-Custom", "1")'));
  assert.ok(out.includes("http.DefaultClient.Do(req)"));
});

test("GET without body passes nil", () => {
  const out = generateGo(parseCurl("curl https://api.example.com"));
  assert.ok(out.includes("http.NewRequest(\"GET\", \"https://api.example.com\", nil)"));
  assert.ok(!out.includes("bytes.NewBufferString"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/gogen.test.ts`
Expected: FAIL — `Cannot find module './gogen.ts'`

- [ ] **Step 3: Implement `gogen.ts`**

Create `src/scripts/curl-code/gogen.ts`:

```ts
import type { CurlRequest } from "./parser.ts";

export function generateGo(req: CurlRequest): string {
  const lines: string[] = [];
  const hasBody = req.body !== undefined;
  lines.push("// import \"net/http\"" + (hasBody ? " and \"bytes\"" : ""));
  const bodyArg = hasBody
    ? `bytes.NewBufferString(${JSON.stringify(req.body)})`
    : "nil";
  lines.push(
    `req, err := http.NewRequest(${JSON.stringify(req.method)}, ${JSON.stringify(req.url)}, ${bodyArg})`,
  );
  lines.push("if err != nil {");
  lines.push("    panic(err)");
  lines.push("}");
  for (const [k, v] of req.headers) {
    lines.push(`req.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }
  lines.push("resp, err := http.DefaultClient.Do(req)");
  lines.push("if err != nil {");
  lines.push("    panic(err)");
  lines.push("}");
  lines.push("defer resp.Body.Close()");
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/gogen.test.ts`
Expected: PASS (2 tests)

---

### Task 14: Rust reqwest generator (curl)

**Files:**
- Create: `src/scripts/curl-code/rustgen.ts`
- Test: `src/scripts/curl-code/rustgen.test.ts`

**Interfaces:**
- Consumes: `CurlRequest` from `./parser.ts`
- Produces (consumed by Task 17): `generateRust(req: CurlRequest): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/rustgen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generateRust } from "./rustgen.ts";

test("custom method uses Method::from_bytes", () => {
  const req = parseCurl('curl -X PURGE https://api.example.com/x -H "X-Custom: 1" -d \'{"a":1}\'');
  const out = generateRust(req);
  assert.ok(out.includes("let client = reqwest::Client::new();"));
  assert.ok(out.includes('.method(reqwest::Method::from_bytes(b"PURGE")?)'));
  assert.ok(out.includes('.url("https://api.example.com/x")'));
  assert.ok(out.includes('.header("X-Custom", "1")'));
  assert.ok(out.includes('.body(r#{"a":1}#)'));
  assert.ok(out.includes(".send()"));
  assert.ok(out.includes(".await?;"));
});

test("GET uses fetch-style helper", () => {
  const out = generateRust(parseCurl("curl https://api.example.com"));
  assert.ok(out.includes(".get(\"https://api.example.com\")"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/rustgen.test.ts`
Expected: FAIL — `Cannot find module './rustgen.ts'`

- [ ] **Step 3: Implement `rustgen.ts`**

Create `src/scripts/curl-code/rustgen.ts`:

```ts
import type { CurlRequest } from "./parser.ts";

const COMMON = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

export function generateRust(req: CurlRequest): string {
  const m = req.method.toLowerCase();
  const lines = ["let client = reqwest::Client::new();", "let resp = client"];
  if (COMMON.has(m)) {
    lines.push(`    .${m}(${JSON.stringify(req.url)})`);
  } else {
    lines.push(`    .method(reqwest::Method::from_bytes(b"${req.method}")?)`);
    lines.push(`    .url(${JSON.stringify(req.url)})`);
  }
  for (const [k, v] of req.headers) {
    lines.push(`    .header(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }
  if (req.body !== undefined) {
    lines.push(`    .body(r#${req.body}#)`);
  }
  lines.push("    .send()");
  lines.push("    .await?;");
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/rustgen.test.ts`
Expected: PASS (2 tests)

---

### Task 15: Python requests generator (curl)

**Files:**
- Create: `src/scripts/curl-code/pygen.ts`
- Test: `src/scripts/curl-code/pygen.test.ts`

**Interfaces:**
- Consumes: `CurlRequest`, `isJsonBody` from `./parser.ts`
- Produces (consumed by Task 17): `generatePython(req: CurlRequest): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/pygen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generatePython } from "./pygen.ts";

test("generates requests.request with JSON body", () => {
  const req = parseCurl('curl -X POST https://api.example.com/users -d \'{"active":true,"n":null}\'');
  const out = generatePython(req);
  assert.ok(out.includes("import requests"));
  assert.ok(out.includes('method="POST"'));
  assert.ok(out.includes('url="https://api.example.com/users"'));
  assert.ok(out.includes("headers=headers,"));
  assert.ok(out.includes('json={"active": True, "n": None},'));
});

test("form body uses data=", () => {
  const out = generatePython(parseCurl("curl -d 'name=Jane' https://api.example.com"));
  assert.ok(out.includes('data="name=Jane",'));
  assert.ok(!out.includes("json="));
});

test("GET without body has no body kwarg", () => {
  const out = generatePython(parseCurl("curl https://api.example.com"));
  assert.ok(!out.includes("json=") && !out.includes("data="));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/pygen.test.ts`
Expected: FAIL — `Cannot find module './pygen.ts'`

- [ ] **Step 3: Implement `pygen.ts`**

Create `src/scripts/curl-code/pygen.ts`:

```ts
import { isJsonBody, type CurlRequest } from "./parser.ts";

export function generatePython(req: CurlRequest): string {
  const lines = ["import requests", ""];
  if (req.headers.length) {
    lines.push("headers = {");
    for (const [k, v] of req.headers) {
      lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    }
    lines.push("}", "");
  }
  const kwargs = [`    method=${JSON.stringify(req.method)}`, `    url=${JSON.stringify(req.url)}`];
  if (req.headers.length) kwargs.push("    headers=headers,");
  if (req.body !== undefined) {
    if (isJsonBody(req)) {
      kwargs.push(`    json=${toPyLiteral(JSON.parse(req.body))},`);
    } else {
      kwargs.push(`    data=${JSON.stringify(req.body)},`);
    }
  }
  kwargs.push(")");
  lines.push("response = requests.request(");
  lines.push(...kwargs);
  return lines.join("\n") + "\n";
}

function toPyLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPyLiteral).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${toPyLiteral(v)}`)
      .join(", ")}}`;
  }
  return "None";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/pygen.test.ts`
Expected: PASS (3 tests)

---

### Task 16: PowerShell generator (curl)

**Files:**
- Create: `src/scripts/curl-code/psgen.ts`
- Test: `src/scripts/curl-code/psgen.test.ts`

**Interfaces:**
- Consumes: `CurlRequest` from `./parser.ts`
- Produces (consumed by Task 17): `generatePowerShell(req: CurlRequest): string`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/psgen.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseCurl } from "./parser.ts";
import { generatePowerShell } from "./psgen.ts";

test("generates Invoke-RestMethod", () => {
  const req = parseCurl('curl -X POST https://api.example.com/users -d \'{"a":1}\'');
  const out = generatePowerShell(req);
  assert.ok(out.includes("$headers = @{"));
  assert.ok(out.includes("'Content-Type' = 'application/json'"));
  assert.ok(out.includes("$body = '{\"a\":1}'"));
  assert.ok(out.includes("Invoke-RestMethod"));
  assert.ok(out.includes("-Method Post"));
  assert.ok(out.includes("-Uri 'https://api.example.com/users'"));
});

test("single quotes are doubled", () => {
  const out = generatePowerShell(parseCurl("curl -d \"a='it's'\" https://api.example.com"));
  assert.ok(out.includes("$body = 'a=''it''s'''"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/psgen.test.ts`
Expected: FAIL — `Cannot find module './psgen.ts'`

- [ ] **Step 3: Implement `psgen.ts`**

Create `src/scripts/curl-code/psgen.ts`:

```ts
import type { CurlRequest } from "./parser.ts";

export function generatePowerShell(req: CurlRequest): string {
  const lines: string[] = [];
  if (req.headers.length) {
    lines.push("$headers = @{");
    for (const [k, v] of req.headers) {
      lines.push(`    ${psStr(k)} = ${psStr(v)}`);
    }
    lines.push("}", "");
  }
  if (req.body !== undefined) {
    lines.push(`$body = ${psStr(req.body)}`, "");
  }
  const method = req.method[0] + req.method.slice(1).toLowerCase();
  const parts = ["Invoke-RestMethod \\", `    -Method ${method} \\`, `    -Uri ${psStr(req.url)} \\`];
  if (req.headers.length) parts.push("    -Headers $headers \\");
  if (req.body !== undefined) parts.push("    -Body $body");
  else parts[parts.length - 1] = parts[parts.length - 1].replace(/ \\$/, "");
  lines.push(parts.join("\n"));
  return lines.join("\n") + "\n";
}

function psStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/psgen.test.ts`
Expected: PASS (2 tests)

---

### Task 17: curl orchestrator + integration test

**Files:**
- Create: `src/scripts/curl-code/generate.ts`
- Test: `src/scripts/curl-code/generate.test.ts`

**Interfaces:**
- Consumes: `parseCurl` from `./parser.ts`; generators from Tasks 12-16
- Produces (consumed by Task 18):
  - `type CurlTarget = "js" | "typescript" | "go" | "rust" | "python" | "powershell"`
  - `generateCode(curl: string, target: CurlTarget): { code: string; warnings: string[] }`

- [ ] **Step 1: Write the failing test**

Create `src/scripts/curl-code/generate.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateCode } from "./generate.ts";

const CMD = 'curl -X POST https://api.example.com/users -H "X-Custom: 1" -d \'{"name":"Jane"}\'';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/scripts/curl-code/generate.test.ts`
Expected: FAIL — `Cannot find module './generate.ts'`

- [ ] **Step 3: Implement `generate.ts`**

Create `src/scripts/curl-code/generate.ts`:

```ts
import { generateFetch } from "./fetchgen.ts";
import { generateGo } from "./gogen.ts";
import { parseCurl } from "./parser.ts";
import { generatePowerShell } from "./psgen.ts";
import { generatePython } from "./pygen.ts";
import { generateRust } from "./rustgen.ts";

export type CurlTarget = "js" | "typescript" | "go" | "rust" | "python" | "powershell";

export interface CurlResult {
  code: string;
  warnings: string[];
}

export function generateCode(curl: string, target: CurlTarget): CurlResult {
  const req = parseCurl(curl);
  let code: string;
  switch (target) {
    case "js":
    case "typescript":
      code = generateFetch(req);
      break;
    case "go":
      code = generateGo(req);
      break;
    case "rust":
      code = generateRust(req);
      break;
    case "python":
      code = generatePython(req);
      break;
    case "powershell":
      code = generatePowerShell(req);
      break;
  }
  return { code, warnings: req.warnings };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test src/scripts/curl-code/generate.test.ts`
Expected: PASS (6 tests)

---

### Task 18: CurlToCode component

**Files:**
- Create: `src/components/CurlToCode.astro`

**Interfaces:**
- Consumes: `generateCode`, `CurlTarget` from `../scripts/curl-code/generate.ts`

- [ ] **Step 1: Write the component**

Create `src/components/CurlToCode.astro`:

```astro
---
---

<div class="app">
  <label class="field">
    <span>cURL command</span>
    <textarea id="c2c-input" spellcheck="false" rows="7" placeholder={'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Jane"}\''}></textarea>
  </label>

  <div class="toolbar">
    <select id="c2c-target" aria-label="Target language">
      <option value="js">JavaScript (fetch)</option>
      <option value="typescript">TypeScript (fetch)</option>
      <option value="go">Go</option>
      <option value="rust">Rust (reqwest)</option>
      <option value="python">Python (requests)</option>
      <option value="powershell">PowerShell</option>
    </select>
    <button id="c2c-convert" type="button">Convert</button>
    <button id="c2c-copy" type="button">Copy</button>
  </div>

  <p id="c2c-warnings" class="warn" hidden></p>
  <p id="c2c-error" class="error" hidden></p>
  <pre id="c2c-output" class="output">Paste a curl command and click Convert.</pre>
</div>

<style>
  .app {
    width: 100%;
  }
  .app textarea,
  .app .output {
    width: 100%;
    box-sizing: border-box;
    margin: 0.5rem 0;
    padding: 0.75rem;
    border: 1px solid var(--sl-color-hairline);
    border-radius: 0.5rem;
    background: var(--sl-color-bg-inline-code);
    color: var(--sl-color-text);
    font-family: var(--__sl-font-mono);
    font-size: 0.875rem;
    line-height: 1.5;
    tab-size: 2;
  }
  .app textarea {
    min-height: 9rem;
    resize: vertical;
  }
  .app .output {
    overflow-x: auto;
    min-height: 8rem;
    white-space: pre;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .toolbar select,
  .toolbar button {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--sl-color-hairline);
    border-radius: 0.375rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-text);
    font: inherit;
  }
  .toolbar button {
    cursor: pointer;
  }
  .toolbar #c2c-convert {
    background: var(--sl-color-accent);
    color: var(--sl-color-text-invert);
  }
  .error {
    color: var(--sl-color-red);
    margin: 0.5rem 0;
  }
  .warn {
    color: var(--sl-color-orange);
    margin: 0.5rem 0;
  }
</style>

<script>
  import { generateCode } from "../scripts/curl-code/generate.ts";
  import type { CurlTarget } from "../scripts/curl-code/generate.ts";

  const input = document.querySelector<HTMLTextAreaElement>("#c2c-input")!;
  const target = document.querySelector<HTMLSelectElement>("#c2c-target")!;
  const convert = document.querySelector<HTMLButtonElement>("#c2c-convert")!;
  const copy = document.querySelector<HTMLButtonElement>("#c2c-copy")!;
  const output = document.querySelector<HTMLPreElement>("#c2c-output")!;
  const error = document.querySelector<HTMLElement>("#c2c-error")!;
  const warnings = document.querySelector<HTMLElement>("#c2c-warnings")!;

  function render() {
    const text = input.value.trim();
    if (!text) {
      output.textContent = "Paste a curl command and click Convert.";
      error.hidden = true;
      warnings.hidden = true;
      return;
    }
    try {
      const result = generateCode(text, target.value as CurlTarget);
      output.textContent = result.code;
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
    await navigator.clipboard.writeText(output.textContent ?? "");
    const label = copy.textContent;
    copy.textContent = "Copied!";
    window.setTimeout(() => {
      copy.textContent = label;
    }, 1500);
  });

  render();
</script>
```

- [ ] **Step 2: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds (page comes in Task 19).

---

### Task 19: cURL to Code page

**Files:**
- Create: `src/content/docs/Tools/curl-to-code.mdx`

**Interfaces:**
- Consumes: `<CurlToCode />` from `../../../components/CurlToCode.astro` (Task 18)

- [ ] **Step 1: Write the page**

Create `src/content/docs/Tools/curl-to-code.mdx`:

```mdx
---
title: cURL to Code
description: Convert curl commands into HTTP request code for JavaScript, TypeScript, Go, Rust, Python, or PowerShell.
icon: seti:shell
---

import CurlToCode from '../../../components/CurlToCode.astro';

Paste a `curl` command below, pick a target language, and convert it into equivalent HTTP request code. The parser handles `-X`, `-H`, `-d`, `-u`, and `-k`; it infers the method from `-d` when `-X` is absent and detects JSON versus form-encoded bodies. Everything runs in your browser; nothing is uploaded.

<CurlToCode />

JSON bodies are passed through the target's native JSON handling, and `-u` credentials become an `Authorization: Basic` header. Multipart `-F` uploads are not supported yet and surface as warnings; other unrecognized flags are skipped gracefully.
```

- [ ] **Step 2: Verify the page builds**

Run: `npm run build`
Expected: build succeeds; `dist/tools/curl-to-code/index.html` exists and contains `id="c2c-input"`.

---

### Task 20: Formatting, full verification, AGENTS.md update

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

Add the following under the `Tools/` line in the **Architecture & Content** bullet list, and add a test command note. Concretely, edit `AGENTS.md`:

Replace:

```markdown
- **Custom Components:** A `SiteToc.astro` component in `src/components/` renders the index page, dynamically listing all docs with their headings.
```

with:

```markdown
- **Custom Components:** A `SiteToc.astro` component in `src/components/` renders the index page, dynamically listing all docs with their headings.
- **Client-Side Web Apps:** `Tools/json-to-code` and `Tools/curl-to-code` embed fully client-side code generators (`JsonToCode.astro`, `CurlToCode.astro`). Their engines live as pure TypeScript modules in `src/scripts/` and are tested with Node's built-in runner via `npm run test:scripts` (no external test framework).
```

Then, in the **Building and Running** table, add a row after the `format:fix` row:

```markdown
| `npm run test:scripts` | Runs engine unit tests with Node's built-in test runner. |
```

- [ ] **Step 2: Run the full verification suite**

Run:

```bash
npm run test:scripts && npm run format:fix && npm run build
```

Expected:
- `test:scripts` passes all engine tests (json-code + curl-code).
- `format:fix` reformats `src/**/*.{md,css,ts}` (generated engine files were written Prettier-style already).
- `npm run build` succeeds and emits `dist/tools/json-to-code/index.html` and `dist/tools/curl-to-code/index.html`.

- [ ] **Step 3: Spot-check generated HTML**

Run: `rg -l 'j2c-input' dist/ && rg -l 'c2c-input' dist/`
Expected: both pages exist with their interactive elements in the static output.

- [ ] **Step 4: (Optional, manual QA)** Run `npm run dev`, open `http://localhost:4321/tools/json-to-code/` and `http://localhost:4321/tools/curl-to-code/`, confirm both apps generate code across all targets and that invalid input shows the inline error area.
