// Screenshots of saved projects' references. The job queue keeps a screenshot for 24 hours;
// saving a project copies it here so it outlives that. Keyed by reference id, so a screenshot
// shared by several projects is stored once. Cloudflare R2 (S3 API) in production, memory otherwise.
import { AwsClient } from "aws4fetch";

export interface ScreenshotStore {
  put(referenceId: string, png: Uint8Array): Promise<void>;
  get(referenceId: string): Promise<Uint8Array | null>;
  has(referenceId: string): Promise<boolean>;
  remove(referenceId: string): Promise<void>;
}

export function createMemoryScreenshotStore(): ScreenshotStore {
  const files = new Map<string, Uint8Array>();
  return {
    put(id, png) {
      files.set(id, png);
      return Promise.resolve();
    },
    get: (id) => Promise.resolve(files.get(id) ?? null),
    has: (id) => Promise.resolve(files.has(id)),
    remove(id) {
      files.delete(id);
      return Promise.resolve();
    },
  };
}

export interface R2Config {
  /** Cloudflare account id: the endpoint is https://<id>.r2.cloudflarestorage.com. */
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Tests pass a fake fetch. */
  fetch?: typeof fetch;
}

export function createR2ScreenshotStore(config: R2Config): ScreenshotStore {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const base = `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}`;
  const url = (id: string) => `${base}/screenshots/${encodeURIComponent(id)}.png`;
  const send = async (id: string, init: RequestInit) => {
    const request = await client.sign(url(id), init);
    return (config.fetch ?? fetch)(request);
  };
  const failed = (what: string, response: Response) =>
    new Error(`R2 ${what} failed: ${response.status} ${response.statusText}`);

  return {
    async put(id, png) {
      const response = await send(id, {
        method: "PUT",
        body: new Uint8Array(png),
        headers: { "content-type": "image/png" },
      });
      if (!response.ok) throw failed("put", response);
    },
    async get(id) {
      const response = await send(id, { method: "GET" });
      if (response.status === 404) return null;
      if (!response.ok) throw failed("get", response);
      return new Uint8Array(await response.arrayBuffer());
    },
    async has(id) {
      const response = await send(id, { method: "HEAD" });
      if (response.status === 404) return false;
      if (!response.ok) throw failed("head", response);
      return true;
    },
    async remove(id) {
      const response = await send(id, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw failed("delete", response);
    },
  };
}
