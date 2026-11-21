// Redis over TLS with Thema's own certificate authority (deploy/worker): where the CA comes from,
// and that a rediss:// connection is told to trust it. No server needed: connections stay lazy.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { redisConnection, redisTlsCa } from "../src/bull.js";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";

describe("redisTlsCa", () => {
  it("reads the PEM text, turning one-line \n escapes back into line breaks", () => {
    expect(redisTlsCa({ REDIS_TLS_CA: PEM })).toBe(PEM);
    expect(redisTlsCa({ REDIS_TLS_CA: PEM.replace(/\n/g, "\n") })).toBe(PEM);
  });

  it("or a file, and is undefined when neither is set", () => {
    const file = join(mkdtempSync(join(tmpdir(), "thema-ca-")), "ca.pem");
    writeFileSync(file, PEM);
    expect(redisTlsCa({ REDIS_TLS_CA_FILE: file })).toBe(PEM);
    expect(redisTlsCa({})).toBeUndefined();
  });
});

describe("redisConnection", () => {
  it("trusts the given CA on rediss://, and adds nothing on plain redis://", () => {
    const secure = redisConnection("rediss://:pw@203.0.113.5:6380", { ca: PEM, lazyConnect: true });
    expect((secure.options.tls as { ca?: string } | undefined)?.ca).toBe(PEM);
    expect(secure.options.maxRetriesPerRequest).toBeNull();
    secure.disconnect();
    const plain = redisConnection("redis://localhost:6379", { ca: PEM, lazyConnect: true });
    expect(plain.options.tls).toBeUndefined();
    plain.disconnect();
  });
});
