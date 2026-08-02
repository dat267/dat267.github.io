const YAML_KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "yes",
  "no",
  "on",
  "off",
  "~",
]);

export function toYaml(value: unknown): string {
  return emit(value, 0) + "\n";
}

function emit(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return pad + "null";
  if (typeof value === "string") return pad + scalar(value);
  if (typeof value === "number") return pad + String(value);
  if (typeof value === "boolean") return pad + (value ? "true" : "false");
  if (Array.isArray(value)) {
    if (value.length === 0) return pad + "[]";
    if (value.every(isScalar))
      return pad + "[" + value.map(scalar).join(", ") + "]";
    const lines: string[] = [];
    for (const item of value) {
      if (isScalar(item)) {
        lines.push(pad + "- " + scalar(item));
        continue;
      }
      const child = emit(item, indent + 1);
      const [first, ...rest] = child.split("\n");
      lines.push(pad + "- " + first.trimStart());
      lines.push(...rest);
    }
    return lines.join("\n");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return pad + "{}";
  const lines: string[] = [];
  for (const [k, v] of entries) {
    if (isScalar(v)) {
      lines.push(pad + key(k) + ": " + scalar(v));
      continue;
    }
    if (Array.isArray(v) && v.every(isScalar)) {
      lines.push(pad + key(k) + ": [" + v.map(scalar).join(", ") + "]");
      continue;
    }
    if (typeof v === "object" && Object.keys(v).length === 0) {
      lines.push(pad + key(k) + ": {}");
      continue;
    }
    lines.push(pad + key(k) + ":");
    lines.push(emit(v, indent + 1));
  }
  return lines.join("\n");
}

function isScalar(v: unknown): v is string | number | boolean | null {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

function scalar(v: string | number | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v.length === 0) return '""';
  if (YAML_KEYWORDS.has(v)) return JSON.stringify(v);
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(v) && /^[-0-9]/.test(v)) {
    return JSON.stringify(v);
  }
  if (/^[-?:,[\]{}#&*!|>'"%@`\s]/.test(v)) return JSON.stringify(v);
  if (/:\s/.test(v) || /\s#/.test(v)) return JSON.stringify(v);
  return v;
}

function key(s: string): string {
  if (/^[A-Za-z0-9_./{}-]+$/.test(s) && !YAML_KEYWORDS.has(s)) return s;
  return JSON.stringify(s);
}
