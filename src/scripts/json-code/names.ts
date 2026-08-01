import type { Field } from "./ast.ts";

export interface NamedType {
  name: string;
  fields: Map<string, Field>;
}

export function pascalCase(s: string): string {
  const words = s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "Type";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

export function snakeCase(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1];
    const next = s[i + 1];
    if (out.length > 0) {
      const prevLower = /[a-z0-9]/.test(prev);
      const isUpper = /[A-Z]/.test(c);
      const nextLower = /[a-z]/.test(next ?? "");
      if (
        (prevLower && isUpper) ||
        (isUpper && /[A-Z]/.test(prev) && nextLower)
      ) {
        out += "_";
      }
    }
    out += c;
  }
  return out.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}

export function tsIdent(s: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) ? s : JSON.stringify(s);
}

const PY_KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "False",
  "None",
  "True",
  "range",
  "type",
]);

export function pyIdent(s: string): string {
  const out = s.replace(/[^A-Za-z0-9_]/g, "_");
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/.test(out) ? out : `field_${out}`;
  return PY_KEYWORDS.has(ident) ? ident + "_" : ident;
}

const RUST_KEYWORDS = new Set([
  "as",
  "break",
  "const",
  "continue",
  "crate",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "async",
  "await",
  "dyn",
]);

export function rustIdent(s: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(s) && !RUST_KEYWORDS.has(s)) return s;
  const out = snakeCase(s);
  return /^[a-z_][a-z0-9_]*$/.test(out) && !RUST_KEYWORDS.has(out)
    ? out
    : `_${out}`;
}

export function collectObjects(
  root: Field,
  rootName: string,
): { root: NamedType | null; all: NamedType[] } {
  const all = new Map<string, NamedType>();
  const walk = (field: Field, suggested: string): string | null => {
    const t = field.type;
    if (t.kind === "array") return walk(t.items, suggested);
    if (t.kind !== "object") return null;
    let name = suggested;
    const existing = all.get(name);
    if (existing && existing.fields !== t.fields) {
      let n = 1;
      while (all.has(`${name}${n}`)) n++;
      name = `${name}${n}`;
    }
    if (!all.has(name)) {
      all.set(name, { name, fields: t.fields });
      t.name = name;
      for (const [key, f] of t.fields) walk(f, pascalCase(key));
    }
    return name;
  };
  const used = walk(root, rootName);
  return {
    root: used ? (all.get(used) ?? null) : null,
    all: [...all.values()],
  };
}
