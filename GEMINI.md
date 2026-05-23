---
title: GEMINI
---

## Project Overview: dat267.github.io

This project is a personal knowledge base and documentation site powered by [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/). It is hosted on GitHub Pages and serves as a collection of technical snippets, commands, and guides.

### Core Technologies

- **Astro:** The underlying web framework for building fast, content-focused websites.
- **Starlight:** An Astro integration specifically designed for high-quality documentation sites.
- **TypeScript:** Used for project configuration and content schemas.
- **Markdown/MDX:** Content is written in standard Markdown and MDX for rich interactivity.

### Architecture & Content

- **Content Location:** All documentation pages are located in `src/content/docs/`.
- **Static Assets:** Public assets (like icons or scripts) are stored in the `public/` directory.
- **Configuration:** Project settings are defined in `astro.config.mjs` and `package.json`.
- **Deployment:** Automated via GitHub Actions (`.github/workflows/deploy.yml`) on every push to the `main` branch.
- **Obsidian Compatibility:** Pre-configured via `.obsidian/app.json` to act as a plug-and-play Obsidian Vault. It hides configuration/developer files and defaults to relative Markdown links for seamless editing and Starlight build alignment.

### Building and Running

The project uses standard npm scripts for development and deployment:

| Command           | Action                                                          |
| :---------------- | :-------------------------------------------------------------- |
| `npm install`     | Installs project dependencies.                                  |
| `npm run dev`     | Starts the local development server at `http://localhost:4321`. |
| `npm run build`   | Generates a static production build in the `dist/` folder.      |
| `npm run preview` | Previews the production build locally.                          |

### Development Conventions

#### Documentation Style

- **Heading Separation:** Always include descriptive text between headings. Avoid back-to-back headings to ensure better readability and flow.
- **Snippets:** Focus on complex, high-value inline scripts and one-liners rather than simple, well-known commands.
- **Code Formatting:** Always remove unnecessary comments and blank lines within code blocks to keep snippets concise and focused.
- **File Organization:**
  - `Bash.md`: Universal Bash/Linux scripts.
  - `Termux.md`: Android-specific automation via Termux:API.
  - `PowerShell.md`: Windows-specific PowerShell snippets.
  - `Git.md`: Git-related utilities and workflows.
  - `Go.md`: Go-specific robust command-line architectures and core utilities.

#### Execution Control

- **Commits & Pushes:** Only stage, commit, or push changes when explicitly requested by the user. Do not perform these actions automatically.

#### Content Structure

- The sidebar navigation is fully automated by Starlight, discovering and organizing all files and folders dynamically.
- The `index.mdx` file serves as the homepage but is hidden from the sidebar via `sidebar: { hidden: true }`.

### Agent Guidelines

#### GEMINI.md Maintenance

- This file serves as the primary context for future AI sessions.
- **Self-Update Mandate:** On any significant deviation in project architecture, tools, conventions, or **documentation contents** (e.g., major new sections or refactors), you must update this file to reflect the new state of the project.
