# @thema/jobs

Extraction jobs behind one interface (`ExtractionQueue`), so the API doesn't care where the browser runs.

|                  | Local (`createLocalQueue`) | Hosted (`@thema/jobs/bull`)                               |
| ---------------- | -------------------------- | --------------------------------------------------------- |
| Runs extractions | in this process            | in a worker process (`pnpm --filter @thema/worker queue`) |
| State            | memory (lost on restart)   | Redis                                                     |
| Rate limit       | `createMemoryRateLimiter`  | `createRedisRateLimiter`                                  |

Both follow the same contract (`test/contract.ts`):

- **Cache:** one job per URL (without its `#fragment`) per UTC day. The job id is derived from that key, so the same URL on the same day returns the same job and runs once. Results are kept for 24 h. A failed job isn't cached: submitting the URL again starts a new one.
- **Concurrency:** at most 3 extractions at a time (SPEC).
- **Retries:** 2 attempts. A `BlockedUrlError` (SSRF guard) is never retried.
- **Stages:** while a job runs, `stage` says where it is: `fetching` (loading the page), `reading` (sampling styles), `naming` (the engine building the system). The extraction reports them through `onStage`; BullMQ keeps them in the job's progress. Done and failed jobs have no stage.
- **Errors:** a failed job reports the first line of the error, at most 300 characters (browser errors can carry whole call logs).
- **Rate limit:** 3 new extractions per client per UTC day, reset at midnight UTC. A refused request doesn't count. The API decides what counts (cache hits don't).

The extraction itself (`RunExtraction`) is passed in, so this package never imports Playwright. The worker provides it (`@thema/worker/job`).

## Tests

`pnpm --filter @thema/jobs test` runs the contract against the local queue and the memory limiter. To run it against BullMQ and Redis too, point `REDIS_URL` at a database the tests may wipe (they call `FLUSHDB`):

```sh
REDIS_URL=redis://localhost:6379/15 pnpm --filter @thema/jobs test
```

Without `REDIS_URL` those tests are skipped.
