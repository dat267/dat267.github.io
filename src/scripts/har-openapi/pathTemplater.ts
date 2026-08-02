const NUM_RE = /^\d+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function templatePath(path: string): string {
  const cleaned = path.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  const segments = cleaned.split("/").filter((s) => s.length > 0);
  let idCount = 0;
  const templated = segments.map((seg) => {
    if (NUM_RE.test(seg) || UUID_RE.test(seg)) {
      idCount += 1;
      return idCount === 1 ? "{id}" : `{id${idCount}}`;
    }
    return seg;
  });
  return "/" + templated.join("/");
}

export function pathParams(template: string): string[] {
  const names = [...template.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  return [...new Set(names)];
}
