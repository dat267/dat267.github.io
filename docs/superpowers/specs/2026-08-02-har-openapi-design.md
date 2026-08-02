# Design: HAR → OpenAPI 3.0.3 Web App

**Date:** 2026-08-02
**Status:** Approved
**Approach:** A — hand-rolled engine in `src/scripts/har-openapi/` (pure TypeScript, no new dependencies), following the site's existing client-side web-app pattern.

## Goal

Add a third client-side web app page (`Tools/har-to-openapi`) that converts an HTTP
Archive (HAR) JSON export into an **OpenAPI 3.0.3** spec in **YAML**. User pastes HAR
JSON, clicks Convert, and copies the resulting spec. Everything runs in the browser.

## Reuse

- `inferType` from `src/scripts/json-code/ast.ts` infers request/response body types.
- The existing `.app`-scoped stylesheet `src/styles/webapps.css` styles the new component;
  no new CSS.

## Architecture

- `src/content/docs/Tools/har-to-openapi.mdx` → imports `src/components/HarToOpenApi.astro`
  (import path `../../../components/...`).
- `src/components/HarToOpenApi.astro` — stacked UI: HAR textarea → toolbar (Convert, Copy)
  → warnings/error areas → output `<pre>`. Bundled `<script>` imports the orchestrator.
- Engine modules under `src/scripts/har-openapi/` (pure TS, tested with `node --test`).

## Engine Modules

### `harTypes.ts`
Minimal structural types for the subset of HAR consumed:
`HarLog`/`HarEntry` with `request { method, url, headers, postData? }`, `response { status, content? }`, and `content { mimeType?, text?, encoding? }`.

### `harParser.ts`
`parseHar(har: unknown): HarEntry[]`
- Validates `har.log.entries` is an array; throws a descriptive error otherwise.
- For each entry: method (uppercased), URL parsed with `new URL()` → path, query,
  origin. Request headers normalized to `[name, value][]`. Request body from
  `postData.text` (and `postData.mimeType`). Response body from `content.text`.
- If `content.encoding === "base64"`, decode with `atob` (wrap in try/catch → warning,
  skip body).
- Skips opaque/binary response bodies (non-text mime or decode failure) with a warning.

### `pathTemplater.ts`
`templatePath(path: string): string`
- Replaces path segments that are integers or UUIDs with `{id}` (UUID regex),
  preserving other segments. `/api/users/123` → `/api/users/{id}`.
- Collapses consecutive `/` and trailing slashes.
- Keeps file-style suffixes (`.json`, `.png`) as-is.

### `groupEntries.ts`
`groupEntries(entries: HarEntry[]): EndpointGroup[]`
- Group key: `(origin, method, templatePath(path))` — entries are grouped per origin so
  cross-host HARs don't collide on paths.
- Query params: union of `(name, value)` pairs across entries (dedup by name).
- Request bodies: merge via `mergeFields(inferType(a), inferType(b))` from json-code.
- Response bodies: merged per status code (key `status`), using the same merge.
- Records the set of status codes seen per group; records whether any entry had an
  `Authorization` header (for security).
- A warning is emitted when more than one distinct origin appears in the HAR; `servers`
  lists only the dominant origin.

### `schema.ts`
`schemaFromField(field: Field): JsonSchema` — OpenAPI-3.0-compatible inline JSON Schema
(draft-07 style, no `$ref`):
- scalars → `{ type: "string" | "number" | "boolean" }`; `any`/`null` → `{}`
- nullable → `{ type: [T, "null"] }` (OpenAPI 3.0 nullable-with-type-array form)
- array → `{ type: "array", items: <schema> }`
- object → `{ type: "object", properties, required?, additionalProperties: false }`,
  `required` = keys present in all objects (from `Field.required`)

This replaces `json-code/jsongen.ts` (which emits `#/definitions/` refs incompatible with
OpenAPI 3.0's `#/components/schemas/`).

### `openapiBuilder.ts`
`buildOpenApi(groups: EndpointGroup[], meta: { title: string; origin: string | null }): object`
Returns the spec as a plain JS object:
- `openapi: "3.0.3"`, `info: { title, version: "1.0.0" }`
- `servers: [{ url: <origin> }]` when a single stable origin exists (dominant origin if several, with the warning from grouping)
- `paths` keyed by templated path; each operation:
  - `operationId`: `<method>_<path with {id}→id>` slug
  - `tags`: `[<first path segment>]`
  - `parameters`: path params (`name`, `in: "path"`, `required: true`, `schema: {type:string}`)
    + query params (`in: "query"`, `schema: {type: "string"}` inferred from the merged
    values via a small scalar-union helper)
  - `requestBody` (when any request body exists): `{ content: { "application/json": {
    schema } } }` using the merged schema and the observed `content-type`
  - `responses`: for each observed status code, `{ description, content? }` with the
    merged response schema when a body was captured
- `components.securitySchemes.basicAuth` + per-operation `security: [{ basicAuth: [] }]`
  when any entry carried an `Authorization: Basic` header (base64 credentials).

### `yaml.ts`
`toYaml(value: unknown, indent = 0): string` — minimal JSON→YAML:
- objects/arrays with 2-space nesting; keys not needing quotes emitted bare
- strings quoted only when required (leading special chars, `: `, `#`, booleans/numbers
  that would be misread, empty); block scalars not used
- `null`/undefined → `null`; booleans/numbers emitted natively

### `generate.ts`
`generateOpenApi(harJson: string): { spec: string; warnings: string[] }`
- `JSON.parse(harJson)` (throws with context on failure)
- `parseHar` → `groupEntries` → `buildOpenApi` → `toYaml`
- Warnings collected from parser/grouping (skipped bodies, non-JSON content types,
  unparseable credentials) and returned alongside the spec.

## Component UI

`HarToOpenApi.astro` mirrors the existing components:
- `#hto-input` textarea (`class="tall"`), `#hto-convert` (primary) + `#hto-copy`
  (secondary) buttons, `#hto-warnings` (`.warn`), `#hto-error` (`.error`), `#hto-output`
  `<pre>` (`.output`)
- Convert on button click + Ctrl/Cmd+Enter; copy button flashes "Copied!"
- All dynamic output via `textContent` (no XSS)

## Page

`src/content/docs/Tools/har-to-openapi.mdx`:
- frontmatter `title`, `description`, `icon: seti:code-search`
- intro paragraph, `<HarToOpenApi />`, short outro (no back-to-back headings, per AGENTS.md)

## Files

- `src/scripts/har-openapi/harTypes.ts`, `harParser.ts`, `pathTemplater.ts`,
  `groupEntries.ts`, `schema.ts`, `openapiBuilder.ts`, `yaml.ts`, `generate.ts`
  (each with a colocated `*.test.ts`)
- `src/components/HarToOpenApi.astro`
- `src/content/docs/Tools/har-to-openapi.mdx`
- `AGENTS.md` (add `Tools/har-to-openapi` to the Client-Side Web Apps bullet)
- `docs/superpowers/specs/2026-08-02-har-openapi-design.md` (this spec)

## Conventions / Constraints

- No new dependencies (plain TypeScript + `node --test`).
- Explicit `.ts` extensions in relative imports.
- All dynamic text through `textContent`; scoped under the existing `.app` stylesheet.
- Prettier must pass on new `.ts`/`.mdx`-adjacent sources (`src/**/*.{md,css,ts}`).
- `npm run test:scripts`, `npm run build` (16 pages), `npm run format:check` must pass.
