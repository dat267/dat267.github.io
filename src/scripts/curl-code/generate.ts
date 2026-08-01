import { generateFetch } from "./fetchgen.ts";
import { generateGo } from "./gogen.ts";
import { parseCurl } from "./parser.ts";
import { generatePowerShell } from "./psgen.ts";
import { generatePython } from "./pygen.ts";
import { generateRust } from "./rustgen.ts";

export type CurlTarget =
  "js" | "typescript" | "go" | "rust" | "python" | "powershell";

export interface CurlResult {
  code: string;
  warnings: string[];
}

export function generateCode(curl: string, target: CurlTarget): CurlResult {
  const req = parseCurl(curl);
  let code: string;
  switch (target) {
    case "js":
    case "typescript":
      code = generateFetch(req);
      break;
    case "go":
      code = generateGo(req);
      break;
    case "rust":
      code = generateRust(req);
      break;
    case "python":
      code = generatePython(req);
      break;
    case "powershell":
      code = generatePowerShell(req);
      break;
    default:
      throw new Error("unknown target: " + target);
  }
  return { code, warnings: req.warnings };
}
