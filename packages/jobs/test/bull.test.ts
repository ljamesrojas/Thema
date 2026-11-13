// Runs the shared contracts against BullMQ + Redis. Needs a Redis database it may wipe:
//   REDIS_URL=redis://localhost:6379/15 pnpm --filter @thema/jobs test
// Skipped when REDIS_URL isn't set.
import { describe } from "vitest";
import {
  createBullQueue,
  createRedisRateLimiter,
  redisConnection,
  startBullWorker,
} from "../src/bull.js";
import { FakeRun, queueContract } from "./contract.js";
import { rateLimitContract } from "./rate-limit-contract.js";

const url = process.env.REDIS_URL ?? "";

describe.skipIf(url === "")("BullMQ + Redis (REDIS_URL)", () => {
  queueContract("bull", async () => {
    const connection = redisConnection(url);
    await connection.flushdb();
    const fake = new FakeRun();
    const clock = { now: new Date("2026-11-13T10:00:00.000Z") };
    const queue = createBullQueue({ connection, backoffMs: 10, now: () => clock.now });
    const workerConnection = redisConnection(url);
    const worker = startBullWorker({ connection: workerConnection, run: fake.run });
    return {
      queue,
      fake,
      clock,
      async close() {
        await worker.close();
        await queue.close();
        connection.disconnect();
        workerConnection.disconnect();
      },
    };
  });

  rateLimitContract("redis", async (clock) => {
    const connection = redisConnection(url);
    await connection.flushdb();
    return {
      limiter: createRedisRateLimiter({ connection, now: () => clock.now }),
      close: () => Promise.resolve(connection.disconnect()),
    };
  });
});
