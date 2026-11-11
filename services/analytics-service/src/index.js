const express = require('express');
const Redis = require('ioredis');

const PORT = Number(process.env.PORT) || 3002;
const TASK_SERVICE_URL = (process.env.TASK_SERVICE_URL || 'http://localhost:8080').replace(/\/$/, '');
const REDIS_URL = process.env.REDIS_URL || '';
const CACHE_TTL_SEC = Number(process.env.CACHE_TTL_SEC) || 10;

const app = express();
app.use(express.json());

let redis = null;
let redisReady = false;

if (REDIS_URL) {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  redis.on('ready', () => { redisReady = true; });
  redis.on('error', () => { redisReady = false; });
  redis.connect().catch(() => {});
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'UP',
    service: 'analytics-service',
    language: 'Node.js',
    redis: redisReady ? 'CONNECTED' : 'BYPASSED',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/analytics', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh && redis && redisReady) {
      const cached = await redis.get('analytics:summary');
      if (cached) {
        return res.json({ ...JSON.parse(cached), cacheSource: 'REDIS_HIT' });
      }
    }

    const resp = await fetch(`${TASK_SERVICE_URL}/api/tasks`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `Task service returned ${resp.status}` });
    }

    const tasks = await resp.json();
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === 'TODO').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const done = tasks.filter((t) => t.status === 'DONE').length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    const summary = {
      total,
      todo,
      inProgress,
      done,
      completionRate,
      cacheTtlSec: CACHE_TTL_SEC,
      updatedAt: new Date().toISOString(),
    };

    if (redis && redisReady) {
      await redis.set('analytics:summary', JSON.stringify(summary), 'EX', CACHE_TTL_SEC);
    }

    return res.json({ ...summary, cacheSource: 'LIVE_COMPUTE' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`analytics-service listening on port ${PORT}`);
});

const shutdown = () => {
  server.close(async () => {
    if (redis) await redis.quit().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

