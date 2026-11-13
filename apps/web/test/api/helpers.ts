// Shared setup for the API route tests: the worker is mocked with recorded fixtures (a URL on
// host "<fixture>.test" extracts as fixtures/<fixture>), DNS is fake, and the clock is fixed.
import { existsSync, readFileSync } from "node:fs";
import { extractSystem, type StyleSample, type ThemaSystem } from "@thema/engine";
import {
  createLocalQueue,
  createMemoryRateLimiter,
  type ExtractionOutput,
  type LocalQueue,
} from "@thema/jobs";
import type { Lookup } from "@thema/url-guard";
import { setServices } from "@/server/services";

const FIXTURES = new URL("../../../../fixtures/", import.meta.url);

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const readSamples = (name: string, file: string): StyleSample[] | undefined => {
  const path = new URL(`${name}/${file}`, FIXTURES);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StyleSample[]) : undefined;
};

/** What the worker would return for a fixture, through the real engine. */
export function fixtureOutput(url: string): ExtractionOutput {
  const host = new URL(url).hostname;
  const name = host.replace(/\.test$/, "");
  const samples = readSamples(name, "samples.json");
  if (!host.endsWith(".test") || !samples) throw new Error(`net::ERR_NAME_NOT_RESOLVED ${host}`);
  const darkSamples = readSamples(name, "samples.dark.json");
  const { system, warnings, derived } = extractSystem({
    samples,
    ...(darkSamples ? { darkSamples } : {}),
    source: { url, borrowed: [], screenshot: "" },
    name: host,
    createdAt: "2026-11-13T10:00:00.000Z",
  });
  return { url, system, warnings, derived, screenshot: PNG };
}

export const fixtureSystem = (name: string): ThemaSystem =>
  fixtureOutput(`https://${name}.test/`).system;

/** *.internal resolves to a private address; everything else to a public one. */
export const fakeDns: Lookup = (host) =>
  Promise.resolve(host.endsWith(".internal") ? ["10.0.0.7"] : ["93.184.215.14"]);

export interface TestServices {
  queue: LocalQueue;
  runs: string[];
  clock: { now: Date };
  /** Hold every extraction at the "reading" stage until released. */
  hold: () => () => void;
}

/** Install fake services for the routes; returns the queue and a log of extractions run. */
export function useFakeServices(): TestServices {
  const clock = { now: new Date("2026-11-13T10:00:00.000Z") };
  const now = () => clock.now;
  const runs: string[] = [];
  let gate: Promise<void> | null = null;
  const queue = createLocalQueue({
    run: async (url, onStage) => {
      runs.push(url);
      onStage("fetching");
      onStage("reading");
      if (gate) await gate;
      return fixtureOutput(url);
    },
    now,
  });
  const hold = () => {
    let release = () => {};
    gate = new Promise((resolve) => {
      release = resolve;
    });
    return () => {
      gate = null;
      release();
    };
  };
  setServices({
    queue,
    limiter: createMemoryRateLimiter({ limit: 3, now }),
    dailyLimit: 3,
    lookup: fakeDns,
    now,
  });
  return { queue, runs, clock, hold };
}

export const PROJECT_ID = "6f1c1b2e-3d4a-4b5c-8d6e-7f8091a2b3c4";

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

/** Call a route handler the way Next.js does. */
export function call(
  handler: Handler,
  options: {
    method?: string;
    path: string;
    id?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  const { method = "GET", path, id = "", body, headers = {} } = options;
  const request = new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  return handler(request, { params: Promise.resolve({ id }) });
}

export async function errorCode(response: Response): Promise<string> {
  const data = (await response.json()) as { error?: { code?: string } };
  return data.error?.code ?? "";
}
