import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,   // prevent crash on too many retries
  enableReadyCheck: false,      // skip "ready" check (avoids timeout)
  reconnectOnError: () => true, // always reconnect
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000); // backoff retry (max 2s)
  },
});

redis.on("connect", () => {
  console.log(" Redis connected");
});

redis.on("error", (err) => {
  console.error(" Redis error:", err.message);
});

export default redis;
