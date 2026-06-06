---
title: README
---

## dat267.github.io

<https://dat267.github.io>

A personal knowledge base and documentation site powered by **Astro Starlight**. It serves as a centralized vault for technical snippets, commands, and guides.

### Setup & Local Development

Follow these steps to clone the repository and get started with local development.

#### 1. Clone the Repository

Clone the project to your local machine using Git.

If you have SSH configured, use:

```bash
git clone git@github.com:dat267/dat267.github.io.git
cd dat267.github.io
```

Alternatively, if SSH (Port 22) is blocked by a firewall, or as a general workaround, clone via HTTPS:

```bash
git clone https://github.com/dat267/dat267.github.io.git
cd dat267.github.io
```

#### 2. Install Dependencies

Install the required Node.js packages using npm:

```bash
npm install
```

#### 3. Start the Dev Server

Launch the local Astro development server with hot-reloading:

```bash
npm run dev
```

The site will be accessible locally at `http://localhost:4321`.

#### 4. Build and Preview

Generate a static production build in the `dist/` directory and preview it locally:

```bash
npm run build
npm run preview
```

### Vault Editing with Obsidian

This repository is pre-configured to be used as a distraction-free, plug-and-play **Obsidian Vault** for writing and editing documentation.

To open the workspace in Obsidian:

1. Launch Obsidian and select **"Open folder as vault"**.
2. Select your cloned `dat267.github.io` directory.

The custom configuration in `.obsidian/app.json` will automatically:

* Hide all build files, dependency folders, and configuration scripts from the file explorer, letting you focus entirely on your content under `src/content/docs/`.
* Enable relative Markdown links to maintain compatibility with the Starlight compiler.
* Redirect dropped/pasted images and attachments to the `/public` folder automatically.
