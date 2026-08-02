import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import go from "@shikijs/langs/go";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import powershell from "@shikijs/langs/powershell";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";

type Core = Awaited<ReturnType<typeof createHighlighterCore>>;

const LANG_IDS = new Set([
  "typescript",
  "javascript",
  "go",
  "python",
  "rust",
  "powershell",
  "yaml",
  "json",
]);

let core: Core | undefined;

async function getCore(): Promise<Core> {
  if (!core) {
    core = await createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [typescript, javascript, go, python, rust, powershell, yaml, json],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return core;
}

export async function highlight(code: string, lang: string): Promise<string> {
  const c = await getCore();
  const safe = LANG_IDS.has(lang) ? lang : "javascript";
  return c.codeToHtml(code, {
    lang: safe,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
}
