import { buildOpenApi } from "./openapiBuilder.ts";
import { groupEntries } from "./groupEntries.ts";
import { parseHar } from "./harParser.ts";
import { toYaml } from "./yaml.ts";
import type { HarFile } from "./harTypes.ts";

export interface OpenApiResult {
  spec: string;
  warnings: string[];
}

export function generateOpenApi(harJson: string): OpenApiResult {
  const warnings: string[] = [];
  let har: unknown;
  try {
    har = JSON.parse(harJson);
  } catch (err) {
    throw new Error(
      "Invalid JSON: " + (err instanceof Error ? err.message : String(err)),
    );
  }
  const entries = parseHar(har, warnings);
  const grouped = groupEntries(entries, warnings);
  const doc = buildOpenApi(grouped, { title: deriveTitle(har) });
  return { spec: toYaml(doc), warnings };
}

function deriveTitle(har: unknown): string {
  const log = (har as HarFile)?.log;
  const title = log?.title;
  const creator = log?.creator?.name;
  return (typeof title === "string" && title) || creator || "API";
}
