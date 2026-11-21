// pnpm --filter @thema/worker queue
// The hosted worker process: takes extraction jobs from Redis (BullMQ, REDIS_URL) and runs them,
// 3 at a time. The API enqueues them (@thema/jobs/bull). Stops cleanly on Ctrl+C / SIGTERM.
import { redisConnection, redisTlsCa, startBullWorker } from "@thema/jobs/bull";
import { runExtraction } from "./job.js";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error("Set REDIS_URL (e.g. redis://localhost:6379) to run the extraction queue.");
  process.exitCode = 2;
} else {
  const worker = startBullWorker({
    connection: redisConnection(redisUrl, { ca: redisTlsCa(process.env) }),
    run: (url, onStage) => runExtraction(url, { onStage }),
  });
  worker.on("active", (job) => console.log(`running ${job.data.url}`));
  worker.on("completed", (job) => console.log(`done    ${job.data.url}`));
  worker.on("failed", (job, error) =>
    console.log(`failed  ${job?.data.url ?? "?"}: ${error.message}`),
  );
  console.log("Waiting for extraction jobs (Ctrl+C to stop) …");

  const stop = () => {
    void worker.close().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
