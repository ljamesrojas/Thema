// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMemoryScreenshotStore, createR2ScreenshotStore } from "@/server/screenshot-store";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/** A fake R2 bucket: an S3-style object store over fetch, recording what it was sent. */
function fakeR2() {
  const objects = new Map<string, Uint8Array>();
  const seen: { method: string; url: string; signed: boolean }[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    const request = input as Request;
    seen.push({
      method: request.method,
      url: request.url,
      signed: (request.headers.get("authorization") ?? "").startsWith("AWS4-HMAC-SHA256"),
    });
    const key = new URL(request.url).pathname;
    switch (request.method) {
      case "PUT":
        objects.set(key, new Uint8Array(await request.arrayBuffer()));
        return new Response(null, { status: 200 });
      case "GET":
      case "HEAD": {
        const body = objects.get(key);
        if (!body) return new Response(null, { status: 404 });
        return new Response(request.method === "GET" ? new Uint8Array(body) : null, {
          status: 200,
        });
      }
      case "DELETE":
        objects.delete(key);
        return new Response(null, { status: 204 });
      default:
        return new Response(null, { status: 405 });
    }
  };
  return { fetch, seen };
}

describe.each([
  [
    "memory",
    () => ({
      store: createMemoryScreenshotStore(),
      seen: [] as { signed: boolean; url: string }[],
    }),
  ],
  [
    "R2",
    () => {
      const r2 = fakeR2();
      const store = createR2ScreenshotStore({
        accountId: "acct",
        bucket: "thema",
        accessKeyId: "key",
        secretAccessKey: "secret",
        fetch: r2.fetch,
      });
      return { store, seen: r2.seen };
    },
  ],
])("screenshot store (%s)", (name, make) => {
  it("puts, finds, gets and removes a screenshot", async () => {
    const { store, seen } = make();
    const id = "a".repeat(24);
    expect(await store.has(id)).toBe(false);
    expect(await store.get(id)).toBeNull();
    await store.put(id, PNG);
    expect(await store.has(id)).toBe(true);
    expect(await store.get(id)).toEqual(PNG);
    await store.remove(id);
    expect(await store.has(id)).toBe(false);
    await store.remove(id);
    if (name === "R2") {
      expect(seen.every((r) => r.signed)).toBe(true);
      expect(seen[0]?.url).toBe(
        `https://acct.r2.cloudflarestorage.com/thema/screenshots/${id}.png`,
      );
    }
  });
});
