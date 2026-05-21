---
title: Content Expansion
sidebar:
  order: 1
---

Procedures for adding new documentation sections and registering custom cards on the landing page.

## Creating a New Page

Create a new Markdown file inside the content directory to automatically add it to the site structure.

1. Create a new `.md` file inside `src/content/docs/` (for example, `docker.md`).
2. Add the minimal required frontmatter at the top of the file:
   ```yaml
   ---
   title: Docker
   ---
   ```
3. Write your documentation content using standard Markdown syntax. The sidebar navigation will automatically discover and list your new page alphabetically.

## Customizing Landing Page Cards

Landing page cards render automatically with sensible defaults (generic document icon, default description, and sorting to the bottom) without any manual configuration. If you want to customize a card's icon, description, or sorting order, you have two flexible options:

### Option A: Direct Frontmatter

Add the metadata directly to your page's frontmatter. The landing page grid will automatically read it:

```yaml
---
title: Docker
description: Container management pipelines and orchestration.
icon: seti:docker
sidebar:
  order: 5
---
```

### Option B: Centralized Map

To keep the page's frontmatter completely minimal (just `title`), register its metadata in the layout component:

1. Open `src/components/AutoGrid.astro`.
2. Locate the static `metaMap` dictionary.
3. Add a new key corresponding to the lowercase slug of your page (e.g., `docker`):
   ```typescript
   docker: {
     order: 5,
     icon: 'seti:docker',
     description: 'Container management pipelines, volume persistence, and multi-container orchestration.'
   }
   ```
