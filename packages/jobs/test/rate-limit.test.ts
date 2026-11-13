import { createMemoryRateLimiter } from "../src/index.js";
import { rateLimitContract } from "./rate-limit-contract.js";

rateLimitContract("memory", (clock) =>
  Promise.resolve({
    limiter: createMemoryRateLimiter({ now: () => clock.now }),
    close: () => Promise.resolve(),
  }),
);
