import { inferType } from "./ast.ts";
import { generateGo } from "./gogen.ts";
import { generateJsonSchema } from "./jsongen.ts";
import { pascalCase } from "./names.ts";
import { generatePython } from "./pygen.ts";
import { generateRust } from "./rustgen.ts";
import { generateTypeScript } from "./tsgen.ts";

export type Target = "typescript" | "go" | "python" | "rust" | "json-schema";

export function generateCode(
  json: string,
  target: Target,
  rootName: string,
): string {
  const root = inferType(JSON.parse(json));
  const name = pascalCase(rootName) || "Root";
  switch (target) {
    case "typescript":
      return generateTypeScript(root, name);
    case "go":
      return generateGo(root, name);
    case "python":
      return generatePython(root, name);
    case "rust":
      return generateRust(root, name);
    case "json-schema":
      return generateJsonSchema(root, name);
    default:
      throw new Error("unknown target: " + target);
  }
}
