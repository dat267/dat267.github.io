# Design: Theme-Consistent Styling for the Code-Generator Web Apps

**Date:** 2026-08-02
**Status:** Approved
**Approach:** A — shared token-based stylesheet registered via Starlight `customCss` (plain CSS, no Tailwind).

## Goal

Restyle the two client-side web apps (`JsonToCode.astro`, `CurlToCode.astro`) so their
controls, editors, and typography are consistent with the default Starlight/Astro theme.
The theme's native look is defined by its design tokens (`--sl-color-*`, `--sl-text-*`,
`--__sl-font-mono`) and its own component styling (nav select, markdown code blocks,
focus rings). No new dependencies; no Tailwind.

## Approach

- Create one shared stylesheet `src/styles/webapps.css`, registered site-wide via
  Starlight's `customCss` option in `astro.config.mjs`.
- All rules are scoped under the `.app` wrapper (both components already render a single
  `<div class="app">`), so nothing leaks onto non-app pages.
- Remove the duplicated `<style>` blocks from both `.astro` components.
- Mark buttons with `.primary` / `.secondary` classes (replacing ID-based styling).
- The `css` file is covered by `npm run format:check` (Prettier glob includes
  `src/**/*.{md,css,ts}`) — it must be Prettier-formatted.

## Visual Spec (concrete token values)

### Editors (textarea + output `<pre>`)

Mirror Starlight's markdown code blocks (`markdown.css` `pre`):

- `border: 1px solid var(--sl-color-gray-5)`
- `border-radius: 0.5rem`
- `padding: 0.75rem 1rem`
- `font-family: var(--__sl-font-mono)`
- `font-size: var(--sl-text-code)`
- `line-height: 1.6`
- `tab-size: 2`
- `background: var(--sl-color-bg-inline-code)` (both, for a unified editable look)
- textarea: `min-height: 12rem` (JSON) / `9rem` (curl), `resize: vertical`
- output: `overflow-x: auto`, `white-space: pre`
- textarea `:focus-visible`:
  - `outline: 1px solid var(--sl-color-accent)`
  - `outline-offset: var(--sl-outline-offset-inside)`

### Toolbar controls (select, root-name input, buttons)

- `background: var(--sl-color-bg)`
- `border: 1px solid var(--sl-color-hairline)`
- `border-radius: 0.25rem`
- `color: var(--sl-color-gray-2)`
- `:hover`: `color: var(--sl-color-white)`, `border-color: var(--sl-color-gray-4)`
- `:focus-visible`: `outline: 1px solid var(--sl-color-accent)` +
  `outline-offset: var(--sl-outline-offset-inside)`
- root-name input: `flex: 1`, `min-width: 8rem`

### Buttons

- `.primary` (Copy in JSON app; Convert in curl app):
  - `background: var(--sl-color-accent)`, `color: var(--sl-color-white)`,
    `font-weight: 500`, `cursor: pointer`
  - `:hover { opacity: 0.9 }`
- `.secondary` (Copy in curl app):
  - transparent background, `1px solid var(--sl-color-hairline)` border,
    `color: var(--sl-color-gray-2)`, `cursor: pointer`
  - `:hover`: `color: var(--sl-color-white)`, `border-color: var(--sl-color-gray-4)`

### Labels and spacing

- `.app .field > span` (the "JSON sample" / "cURL command" labels):
  - `display: block`, `font-size: var(--sl-text-sm)`, `color: var(--sl-color-gray-2)`,
    `margin-bottom: 0.25rem`
- editors: `margin: 0.75rem 0`
- toolbar: `display: flex`, `flex-wrap: wrap`, `gap: 0.5rem`, `align-items: center`

### Feedback areas

- `.error`: `color: var(--sl-color-red)`, `margin: 0.5rem 0`
- `.warn`: `color: var(--sl-color-orange)`, `margin: 0.5rem 0`

## Component Markup Changes

- `JsonToCode.astro`: add `class="primary"` to the `#j2c-copy` button; delete the
  `<style>` block. Everything else (IDs, script, structure) unchanged.
- `CurlToCode.astro`: add `class="primary"` to `#c2c-convert` and `class="secondary"`
  to `#c2c-copy`; delete the `<style>` block. Everything else unchanged.

## Files

- `src/styles/webapps.css` (new — all shared `.app`-scoped rules)
- `astro.config.mjs` (modify — add `customCss: ['./src/styles/webapps.css']` to the
  Starlight config)
- `src/components/JsonToCode.astro` (modify — button class, remove `<style>`)
- `src/components/CurlToCode.astro` (modify — button classes, remove `<style>`)
- `docs/superpowers/specs/2026-08-02-webapps-theme-styling-design.md` (this spec)

## Conventions / Constraints

- No new dependencies (plain CSS only; Tailwind explicitly declined).
- No behavior changes: scripts, IDs, layout order, and the bundled-engine wiring stay
  identical — this is a styling-only change.
- Prettier must pass on `src/styles/webapps.css`.
- `npm run build` must succeed and both pages must still contain their component IDs.
