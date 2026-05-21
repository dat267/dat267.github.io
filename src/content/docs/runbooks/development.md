---
title: Development & Maintenance
sidebar:
  order: 2
---

Procedures for running the local environment, validating builds, and troubleshooting deployments.

## Local Development Lifecycle

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

## Troubleshooting Deployment Failures

If the automated GitHub Actions deployment workflow fails, follow these steps to isolate and resolve the issue.

1. Check the local build logs by running `npm run build` to see if there are missing dependencies, syntax errors, or invalid import paths.
2. Ensure all file paths in Markdown links are relative and case-sensitive (use `[Git](../git.md)` instead of `[Git](/Git.md)`).
3. If Starlight loaders fail to parse content, verify that all frontmatter blocks are correctly bounded by `---` and contain valid YAML.
