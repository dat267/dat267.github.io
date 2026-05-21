---
title: Runbooks
---

A collection of operational procedures and step-by-step guides for maintaining, expanding, and troubleshooting this knowledge base.

## Content Expansion

Procedures for adding new documentation sections and registering custom cards on the landing page.

### Creating a New Page

Create a new Markdown file inside the content directory to automatically add it to the site structure.

1. Create a new `.md` file inside `src/content/docs/` (for example, `docker.md`).
2. Add the minimal required frontmatter at the top of the file:
   ```yaml
   ---
   title: Docker
   ---
   ```
3. Write your documentation content using standard Markdown syntax. The sidebar navigation will automatically discover and list your new page alphabetically.

### Customizing Landing Page Cards

Landing page cards render automatically with sensible defaults (generic document icon, default description, and sorting to the bottom) without any manual configuration. If you want to customize a card's icon, description, or sorting order, you have two flexible options:

#### Option A: Direct Frontmatter (Standard Starlight)

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

#### Option B: Centralized Map (Zero Frontmatter Bloat)

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

## Development & Maintenance

Procedures for running the local environment, validating builds, and troubleshooting deployments.

### Local Development Lifecycle

Run a standard validation cycle before pushing any changes to the remote repository.

1. Start the live local development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:4321` in your browser to verify hot-reloads and visual rendering.
3. Verify the static production build compiles with no errors or warnings:
   ```bash
   npm run build
   ```
4. Preview the compiled production build locally to ensure asset paths resolve:
   ```bash
   npm run preview
   ```

### Troubleshooting Deployment Failures

If the automated GitHub Actions deployment workflow fails, follow these steps to isolate and resolve the issue.

1. Check the local build logs by running `npm run build` to see if there are missing dependencies, syntax errors, or invalid import paths.
2. Ensure all file paths in Markdown links are relative and case-sensitive (use `[Git](git.md)` instead of `[Git](/Git.md)`).
3. If Starlight loaders fail to parse content, verify that all frontmatter blocks are correctly bounded by `---` and contain valid YAML.
