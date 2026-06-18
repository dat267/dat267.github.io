import fs from "node:fs";
import path from "node:path";
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
const getPhysicalDirs = () => {
  const docsDir = path.resolve("src/content/docs");
  if (!fs.existsSync(docsDir)) return [];
  const dirs: string[] = [];
  const walk = (dir: string) => {
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        dirs.push(file);
        walk(fullPath);
      }
    }
  };
  walk(docsDir);
  return dirs;
};
export const onRequest = defineRouteMiddleware((context) => {
  const { sidebar } = context.locals.starlightRoute;
  const physicalDirs = getPhysicalDirs();
  function updateLabels(entries: any[]) {
    for (const entry of entries) {
      if (entry.type === "group") {
        const matchedDir = physicalDirs.find(
          (d) => normalize(d) === normalize(entry.label),
        );
        if (matchedDir) {
          entry.label = matchedDir;
        }
        if (entry.entries) {
          updateLabels(entry.entries);
        }
      }
    }
  }
  updateLabels(sidebar);
});
