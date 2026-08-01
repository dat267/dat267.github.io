# Web App Theme Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `JsonToCode.astro` and `CurlToCode.astro` so their editors, controls, and typography match the default Starlight theme, using a single shared token-based stylesheet registered via `customCss`.

**Architecture:** One global stylesheet `src/styles/webapps.css` is registered site-wide through Starlight's `customCss` option. Every rule is scoped under the `.app` wrapper (both components render `<div class="app">`), so nothing leaks onto non-app pages. The duplicated per-component `<style>` blocks are deleted; buttons get `.primary`/`.secondary` classes; per-app textarea heights use a `.tall` modifier.

**Tech Stack:** Astro 7, Starlight 0.41, plain CSS using Starlight's design tokens (`--sl-color-*`, `--sl-text-*`, `--__sl-font-mono`, `--sl-outline-offset-inside`). No new dependencies, no Tailwind.

## Global Constraints

- **No new dependencies.** Plain CSS only (Tailwind explicitly declined by the user).
- **No behavior changes.** Scripts, IDs, layout order, and bundled-engine wiring stay identical — this is a styling-only change.
- **All rules scoped under `.app`.** The shared stylesheet must not affect non-app pages.
- **`.primary`/`.secondary` rules must follow the generic control rule** so they override `background`/`color` (specificity is otherwise equal).
- **Prettier must pass** on `src/styles/webapps.css` (CI runs `format:check` over `src/**/*.{md,css,ts}`).
- **`npm run build` must succeed** and both pages must still contain their component IDs (`j2c-input`, `c2c-input`).
- **No commits** unless the user explicitly asks (AGENTS.md).

## File Structure

- `src/styles/webapps.css` (new) — all shared `.app`-scoped token-based rules
- `astro.config.mjs` (modify) — add `customCss: ['./src/styles/webapps.css']`
- `src/components/JsonToCode.astro` (modify) — `class="tall"` on textarea, `class="primary"` on copy button, remove `<style>`
- `src/components/CurlToCode.astro` (modify) — `class="primary"` on convert, `class="secondary"` on copy, remove `<style>`
- `AGENTS.md` (modify) — note the shared webapp stylesheet + `customCss`
- `docs/superpowers/plans/2026-08-02-webapps-theme-styling.md` (this plan)

Each task ends by running `npm run build`.

---

### Task 1: Shared stylesheet + config registration

**Files:**
- Create: `src/styles/webapps.css`
- Modify: `astro.config.mjs`

**Interfaces:**
- Produces (consumed by Tasks 2-3): global `.app`-scoped rules for `.field`, `textarea`, `.output`, `.toolbar`, `.error`, `.warn`, and `.primary`/`.secondary` button variants.

- [ ] **Step 1: Create `src/styles/webapps.css`**

Create `src/styles/webapps.css`:

```css
.app {
  width: 100%;
}

.app .field > span {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--sl-color-gray-2);
  font-size: var(--sl-text-sm);
}

.app textarea,
.app .output {
  box-sizing: border-box;
  width: 100%;
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--sl-color-gray-5);
  border-radius: 0.5rem;
  background: var(--sl-color-bg-inline-code);
  color: var(--sl-color-text);
  font-family: var(--__sl-font-mono);
  font-size: var(--sl-text-code);
  line-height: 1.6;
  tab-size: 2;
}

.app textarea {
  min-height: 9rem;
  resize: vertical;
}

.app textarea.tall {
  min-height: 12rem;
}

.app textarea:focus-visible {
  outline: 1px solid var(--sl-color-accent);
  outline-offset: var(--sl-outline-offset-inside);
}

.app .output {
  overflow-x: auto;
  min-height: 8rem;
  white-space: pre;
}

.app .toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.app .toolbar select,
.app .toolbar input,
.app .toolbar button {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--sl-color-hairline);
  border-radius: 0.25rem;
  background: var(--sl-color-bg);
  color: var(--sl-color-gray-2);
  font: inherit;
}

.app .toolbar select:hover,
.app .toolbar button:hover {
  color: var(--sl-color-white);
  border-color: var(--sl-color-gray-4);
}

.app .toolbar select:focus-visible,
.app .toolbar input:focus-visible,
.app .toolbar button:focus-visible {
  outline: 1px solid var(--sl-color-accent);
  outline-offset: var(--sl-outline-offset-inside);
}

.app .toolbar select,
.app .toolbar button {
  cursor: pointer;
}

.app .toolbar input {
  flex: 1;
  min-width: 8rem;
  cursor: text;
}

.app .toolbar input:hover {
  color: var(--sl-color-gray-2);
  border-color: var(--sl-color-gray-4);
}

.app .toolbar button.primary {
  border-color: transparent;
  background: var(--sl-color-accent);
  color: var(--sl-color-white);
  font-weight: 500;
}

.app .toolbar button.primary:hover {
  border-color: transparent;
  color: var(--sl-color-white);
  opacity: 0.9;
}

.app .error {
  margin: 0.5rem 0;
  color: var(--sl-color-red);
}

.app .warn {
  margin: 0.5rem 0;
  color: var(--sl-color-orange);
}
```

- [ ] **Step 2: Register the stylesheet in `astro.config.mjs`**

Modify `astro.config.mjs` to add `customCss` to the Starlight config (add it after `lastUpdated: true`):

```js
export default defineConfig({
  site: "https://dat267.github.io",
  integrations: [
    starlight({
      title: "dat267.github.io",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/dat267/dat267.github.io",
        },
      ],
      lastUpdated: true,
      customCss: ["./src/styles/webapps.css"],
    }),
  ],
});
```

- [ ] **Step 3: Verify formatting and build**

Run:
```bash
npm run format:fix
npm run build
```

Expected:
- `format:fix` reformats `src/styles/webapps.css` (Prettier covers `src/**/*.{md,css,ts}`) and `astro.config.mjs`.
- Build succeeds (15 pages). `dist/index.html` now references the webapps stylesheet (a `/_astro/webapps.*.css` asset exists in `dist/_astro/`).

---

### Task 2: JsonToCode component

**Files:**
- Modify: `src/components/JsonToCode.astro`

**Interfaces:**
- Consumes: `.app`-scoped global styles from Task 1.

- [ ] **Step 1: Update the component**

Make three edits to `src/components/JsonToCode.astro`:

1. Add `class="tall"` to the textarea element:
```astro
<textarea id="j2c-input" class="tall" spellcheck="false" placeholder={'{"name":"Jane","age":30,"active":true,"tags":["a"],"meta":{"ok":true}}'}></textarea>
```

2. Add `class="primary"` to the copy button:
```astro
<button id="j2c-copy" class="primary" type="button">Copy</button>
```

3. Delete the entire `<style>` block (from `<style>` on line 26 through `</style>` on line 83). The component becomes frontmatter + `.app` markup + `<script>` only.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds; `dist/tools/json-to-code/index.html` still contains `id="j2c-input"`.

---

### Task 3: CurlToCode component

**Files:**
- Modify: `src/components/CurlToCode.astro`

**Interfaces:**
- Consumes: `.app`-scoped global styles from Task 1.

- [ ] **Step 1: Update the component**

Make three edits to `src/components/CurlToCode.astro`:

1. Add `class="primary"` to the Convert button:
```astro
<button id="c2c-convert" class="primary" type="button">Convert</button>
```

2. Add `class="secondary"` to the Copy button:
```astro
<button id="c2c-copy" class="secondary" type="button">Copy</button>
```

3. Delete the entire `<style>` block (from `<style>` on line 26 through `</style>` on line 86). The component becomes frontmatter + `.app` markup + `<script>` only.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds; `dist/tools/curl-to-code/index.html` still contains `id="c2c-input"`.

---

### Task 4: AGENTS.md note + full verification

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

In the **Architecture & Content** bullet list, update the **Custom Components** bullet to mention the shared stylesheet. Change:

```markdown
- **Custom Components:** A `SiteToc.astro` component in `src/components/` renders the index page, dynamically listing all docs with their headings.
```

to:

```markdown
- **Custom Components:** A `SiteToc.astro` component in `src/components/` renders the index page, dynamically listing all docs with their headings.
- **Web App Styling:** The client-side web apps' shared styles live in `src/styles/webapps.css` (scoped under `.app`), registered via Starlight's `customCss` in `astro.config.mjs`.
```

- [ ] **Step 2: Run the full verification suite**

Run:
```bash
npm run format:fix
npm run test:scripts
npm run build
npm run format:check
```

Expected:
- `test:scripts` passes (67/67 engine tests — unchanged by styling).
- Build succeeds (15 pages).
- `format:check` prints "All matched files use Prettier code style!".

- [ ] **Step 3: Spot-check the built pages**

Run:
```bash
rg -l 'j2c-input' dist/tools/json-to-code/index.html
rg -l 'c2c-input' dist/tools/curl-to-code/index.html
rg -l 'class="primary"' dist/tools/json-to-code/index.html dist/tools/curl-to-code/index.html
```

Expected: each command returns the page HTML file(s); both pages carry the `primary` button class.

- [ ] **Step 4: (Optional, manual QA)** Run `npm run dev`, open `http://localhost:4321/tools/json-to-code/` and `http://localhost:4321/tools/curl-to-code/` in both light and dark themes; confirm editors/controls use the theme's colors, focus rings appear on keyboard focus, and the apps still work end-to-end.
