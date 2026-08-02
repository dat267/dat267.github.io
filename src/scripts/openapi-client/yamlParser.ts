interface Line {
  indent: number;
  text: string;
}

export function parseYaml(input: string): unknown {
  const lines = toLines(collapseBlockScalars(input.split("\n")));
  if (lines.length === 0) return undefined;
  const { value } = parseBlock(lines, 0, lines[0].indent);
  return value;
}

function toLines(rawLines: string[]): Line[] {
  const out: Line[] = [];
  for (const raw of rawLines) {
    const indent = (raw.match(/^ */) ?? [""])[0].length;
    const content = stripComment(raw.slice(indent)).trimEnd();
    if (content.trim() === "" || content.trim().startsWith("#")) continue;
    out.push({ indent, text: content.trim() });
  }
  return out;
}

function collapseBlockScalars(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const indent = (line.match(/^ */) ?? [""])[0].length;
    const content = line.slice(indent).trim();
    const bm = content.match(/^(- )?([^:]+:\s*)([|>])(\s*[+-]?)?$/);
    if (bm) {
      const prefix = bm[1] ?? "";
      let j = i + 1;
      let minIndent = Infinity;
      for (let k = i + 1; k < lines.length; k++) {
        const r = lines[k];
        if (r.trim() === "") continue;
        const ri = (r.match(/^ */) ?? [""])[0].length;
        if (ri <= indent) break;
        minIndent = Math.min(minIndent, ri);
      }
      if (minIndent === Infinity) minIndent = indent + 1;
      const blockLines: string[] = [];
      for (let k = i + 1; k < lines.length; k++) {
        const r = lines[k];
        const ri = (r.match(/^ */) ?? [""])[0].length;
        if (r.trim() !== "" && ri <= indent) break;
        blockLines.push(r.slice(Math.min(ri, minIndent)));
        j = k + 1;
      }
      const text =
        bm[3] === "|"
          ? blockLines.join("\n")
          : blockLines
              .join(" ")
              .replace(/[ \t]+/g, " ")
              .trim();
      out.push(" ".repeat(indent) + prefix + bm[2] + JSON.stringify(text));
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out;
}

function stripComment(s: string): string {
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote && s[i - 1] !== "\\") quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
    } else if (
      c === "#" &&
      (i === 0 || s[i - 1] === " " || s[i - 1] === "\t")
    ) {
      return s.slice(0, i);
    }
  }
  return s;
}

function parseBlock(
  lines: Line[],
  start: number,
  indent: number,
): { value: unknown; next: number } {
  if (start >= lines.length) return { value: undefined, next: start };
  if (lines[start].text.startsWith("-"))
    return parseSequence(lines, start, indent);
  return parseMapping(lines, start, indent);
}

function parseMapping(
  lines: Line[],
  start: number,
  indent: number,
): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) break;
    if (line.text.startsWith("-")) break;
    const idx = findColon(line.text);
    if (idx < 0) {
      i++;
      continue;
    }
    const key = unquote(line.text.slice(0, idx).trim());
    const rest = line.text.slice(idx + 1).trim();
    if (rest === "") {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const sub = parseBlock(lines, i + 1, lines[i + 1].indent);
        obj[key] = sub.value;
        i = sub.next;
      } else {
        obj[key] = null;
        i++;
      }
    } else {
      obj[key] = parseInline(rest);
      i++;
    }
  }
  return { value: obj, next: i };
}

function parseSequence(
  lines: Line[],
  start: number,
  indent: number,
): { value: unknown[]; next: number } {
  const arr: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) break;
    if (!line.text.startsWith("-")) break;
    const rest = line.text.replace(/^-\s*/, "").trim();
    if (rest === "") {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const sub = parseBlock(lines, i + 1, lines[i + 1].indent);
        arr.push(sub.value);
        i = sub.next;
      } else {
        arr.push(null);
        i++;
      }
      continue;
    }
    const colon = findColon(rest);
    if (colon >= 0) {
      const obj: Record<string, unknown> = {};
      obj[unquote(rest.slice(0, colon).trim())] = parseInline(
        rest.slice(colon + 1).trim(),
      );
      i++;
      while (i < lines.length && lines[i].indent > indent) {
        const sub = parseMapping(lines, i, lines[i].indent);
        Object.assign(obj, sub.value);
        i = sub.next;
      }
      arr.push(obj);
      continue;
    }
    arr.push(parseInline(rest));
    i++;
  }
  return { value: arr, next: i };
}

function parseInline(s: string): unknown {
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (s[0] === "{") return parseFlowMap(s);
  if (s[0] === "[") return parseFlowSeq(s);
  if (s[0] === "'" || s[0] === '"') return unquote(s);
  if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return Number(s);
  return s;
}

function parseFlowMap(s: string): Record<string, unknown> {
  const inner = s.slice(1, s[s.length - 1] === "}" ? -1 : undefined).trim();
  const obj: Record<string, unknown> = {};
  for (const part of splitFlow(inner)) {
    if (part === "") continue;
    const idx = findColon(part);
    if (idx < 0) continue;
    obj[unquote(part.slice(0, idx).trim())] = parseInline(
      part.slice(idx + 1).trim(),
    );
  }
  return obj;
}

function parseFlowSeq(s: string): unknown[] {
  const inner = s.slice(1, s[s.length - 1] === "]" ? -1 : undefined).trim();
  if (inner === "") return [];
  return splitFlow(inner).map((p) => parseInline(p.trim()));
}

function splitFlow(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      cur += c;
      if (c === quote && inner[i - 1] !== "\\") quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === "{" || c === "[") {
      depth++;
      cur += c;
    } else if (c === "}" || c === "]") {
      depth--;
      cur += c;
    } else if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts;
}

function findColon(s: string): number {
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote && s[i - 1] !== "\\") quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
    } else if (c === ":" && (s[i + 1] === " " || s[i + 1] === undefined)) {
      return i;
    }
  }
  return -1;
}

function unquote(s: string): string {
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return s;
}
