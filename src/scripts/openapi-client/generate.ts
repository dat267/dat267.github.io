import { buildClientModel } from "./clientModel.ts";
import { renderGoClient } from "./gogen.ts";
import { renderJsClient } from "./jsgen.ts";
import { renderPsClient } from "./psgen.ts";
import { renderPyClient } from "./pygen.ts";
import { renderRsClient } from "./rustgen.ts";
import { parseSpec } from "./specParser.ts";
import { renderTsClient } from "./tsgen.ts";

export type ClientTarget =
  "typescript" | "javascript" | "go" | "python" | "rust" | "powershell";

export interface ClientResult {
  code: string;
  warnings: string[];
}

export function generateClient(
  specText: string,
  target: ClientTarget,
): ClientResult {
  const warnings: string[] = [];
  const spec = parseSpec(specText, warnings);
  const model = buildClientModel(spec, warnings);
  let code: string;
  switch (target) {
    case "typescript":
      code = renderTsClient(model);
      break;
    case "javascript":
      code = renderJsClient(model);
      break;
    case "go":
      code = renderGoClient(model);
      break;
    case "python":
      code = renderPyClient(model);
      break;
    case "rust":
      code = renderRsClient(model);
      break;
    case "powershell":
      code = renderPsClient(model);
      break;
  }
  return { code, warnings };
}
