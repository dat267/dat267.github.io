# Design: Client-Side Code Generators (JSON → Code, cURL → Code)

**Date:** 2026-08-02
**Status:** Approved
**Approach:** A — hand-rolled TypeScript generators in `.astro` components (no new dependencies, no CDN).

## Goal

Add two documentation pages to the Starlight site, each embedding a fully client-side
web app:

1. **JSON → Code** (quicktype-style): paste JSON, get typed code in TypeScript, Go,
   Python, Rust, or a JSON Schema.
2. **cURL → Code**: paste a `curl` command, get equivalent code in JS (fetch), TypeScript
   (fetch), Go (`http.NewRequest`), Rust (reqwest), Python (`requests`), or PowerShell
   (`Invoke-RestMethod`).

Both apps run entirely in the browser with no backend, no new dependencies, and no CDN
scripts. They must fit within the standard Starlight content column (45rem).

## Architecture

- Two content pages under `src/content/docs/Tools/`:
  - `json-to-code.mdx`
  - `curl-to-code.mdx`
- Two `.astro` components under `src/components/`:
  - `JsonToCode.astro`
  - `CurlToCode.astro`
- Each component embeds its full engine in a `<script>` block. Astro/Vite bundles it into
  a hashed static module that executes on page load (identical mechanism to Starlight's own
  Search/TOC scripts). No `client:` directive is required for plain scripts.
- The MDX pages import their component exactly like `src/content/docs/index.mdx` imports
  `SiteToc.astro` (relative import path `../../components/...` from `src/content/docs/Tools/`).

## Component: JsonToCode.astro

### UI (stacked, within 45rem)

1. JSON input `<textarea>` (monospace, ~14 rows, placeholder showing a sample payload).
2. Toolbar: target selector (`typescript | go | python | rust | json-schema`), top-level
   type-name input, Copy button.
3. Output `<pre>` (monospace, read-only) with a hint when empty.

### Type inference

- Parse input with `JSON.parse`.
- Recursively infer a type AST:
  - `string`, `number`, `boolean`, `null`
  - `{ kind: 'array', items: Type }` — items inferred by merging array elements
  - `{ kind: 'object', fields: Map<string, Type> }` — field order preserved, object element
    schemas merged across array members
- Nullable handling: a field whose values include `null` and another type becomes a union
  member that each generator maps to its nullable idiom.
- Top-level inputs may be an object or an array.

### Generators

- **TypeScript:** `interface` declarations; named interfaces for nested objects (PascalCase
  names derived from field names); arrays as `Type[]`; nullable as `| null`.
- **Go:** `type Name struct { Field Type \`json:"field"\` }`; nullable fields as pointers;
  slices as `[]Type`; nested objects as named types.
- **Python:** `@dataclass` classes using `from __future__ import annotations`; `Optional[T]`
  for nullable; `List[T]` via `list[T]`.
- **Rust:** `#[derive(Serialize, Deserialize, Debug)]` structs; `Option<T>` for nullable;
  `Vec<T>` for arrays; serde field attributes.
- **JSON Schema:** draft-07; `type`, `properties`, `items`, `required` (all keys present in
  every object), `additionalProperties: false`.

### Behavior

- Debounce input by ~200 ms; re-run inference + generation automatically.
- Invalid JSON: show the parse error message (with approximate line/column) in an inline
  error area; keep the last valid output untouched.
- Copy button uses `navigator.clipboard` with a transient "Copied" state.

## Component: CurlToCode.astro

### UI (stacked, within 45rem)

1. cURL command `<textarea>` (monospace, ~8 rows, placeholder sample).
2. Toolbar: target selector (`js | typescript | go | rust | python | powershell`), Convert
   button, Copy button.
3. Output `<pre>` (monospace, read-only) with a hint when empty.

### Parser

Parse a single `curl` command into a request model:

```
{ method: string, url: string, headers: Array<[string, string]>, body?: string }
```

Supported flags:

- `-X` / `--request`
- `-d` / `--data` / `--data-binary` / `--data-raw` (last occurrence wins for body)
- `-H` / `--header` (repeatable; strip leading/trailing whitespace, split on first `:`)
- `-u` / `--user` → added as an `Authorization: Basic` header (base64 via `btoa`)
- `-k` / `--insecure` → noted (skipped for targets with no equivalent)
- `-F` / `--form` → out of scope for v1 (emit a warning and skip)
- Positional argument → the URL

Parsing rules:

- Strip surrounding quotes from each token value (`'...'` and `"..."`).
- Support short-flag collapsing (e.g. `-XPOST` is not supported — only `-X POST` — but
  combined boolean flags like `-sk` are). Non-flag tokens after a URL are ignored.
- Method inference: explicit `-X` wins; otherwise `-d` present → `POST`, else `GET`.
- Body detection: body starting with `{` or `[` → treated as raw JSON (`Content-Type:
  application/json`); otherwise treated as form-encoded (`application/x-www-form-urlencoded`).

### Generators

- **JS / TS (fetch):** `fetch(url, { method, headers, body })`.
- **Go:** `http.NewRequest` + `req.Header.Set`, `bytes.NewBufferString` for body.
- **Rust (reqwest):** `reqwest::Client` builder + `.method(...).header(...).body(...)`.
- **Python (requests):** `requests.request(method, url, headers=..., data=...)`.
- **PowerShell:** `Invoke-RestMethod -Method ... -Uri ... -Headers @{...} -Body ...`.

### Behavior

- Generation runs on Convert button press (not debounced).
- Unknown/unhandled flags: collect warnings, show in a small inline area, continue anyway.
- Unparseable input (no URL found): show an error message, no output.

## Shared UX

- Monospace fonts for editors and output.
- Scoped `<style>` blocks (Astro scopes automatically). Use Starlight's `--sl-color-*`
  CSS variables for surfaces, borders, accents so both light/dark themes work.
- Single wrapper `<div class="app">` (max-width 100%) so nothing spills out of the content
  column.
- Inline error/warning areas with theme-aware styling.
- No external libraries, no icons beyond text labels.

## Verification

- No test runner exists in this repo (deps are `astro`, `@astrojs/starlight`, `prettier`).
  Adding a framework is out of scope.
- Verification steps: `npm run format:fix`, `npm run build` (must succeed), and a manual
  pass in `npm run dev` exercising both apps (valid/invalid input, each target).

## Files

- `src/components/JsonToCode.astro` (new)
- `src/components/CurlToCode.astro` (new)
- `src/content/docs/Tools/json-to-code.mdx` (new)
- `src/content/docs/Tools/curl-to-code.mdx` (new)
- `docs/superpowers/specs/2026-08-02-client-side-code-generators-design.md` (this spec)

## Conventions

- Frontmatter per `src/content/docs/Tools/Git.md`: `title`, `description`, `icon`.
- Descriptive intro text before the component and, if useful, a short note after it — never
  back-to-back headings (AGENTS.md).
- Keep code in scripts concise; no unnecessary comments or blank lines in output code blocks.
