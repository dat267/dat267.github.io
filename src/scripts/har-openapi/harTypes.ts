export interface HarEntry {
  request: {
    method: string;
    url: string;
    headers?: Array<{ name: string; value: string }>;
    postData?: { mimeType?: string; text?: string };
  };
  response: {
    status: number;
    content?: { mimeType?: string; text?: string; encoding?: string };
  };
}

export interface HarFile {
  log?: {
    title?: string;
    creator?: { name?: string };
    entries?: HarEntry[];
  };
}
