const express = require('express');
const Redis = require('ioredis');

const PORT = Number(process.env.PORT) || 3003;
const TASK_SERVICE_URL = (process.env.TASK_SERVICE_URL || 'http://localhost:8080').replace(/\/$/, '');
const NOTIFICATION_SERVICE_URL = (process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8081').replace(/\/$/, '');
const AUDIT_SERVICE_URL = (process.env.AUDIT_SERVICE_URL || 'http://localhost:8082').replace(/\/$/, '');
const REDIS_URL = process.env.REDIS_URL || '';
const CRON_INTERVAL_MS = Number(process.env.CRON_INTERVAL_MS) || 30000;

const app = express();
app.use(express.json());

let redis = null;
let redisReady = false;
const jobHistory = [];

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

async function runDigestJob(triggerSource = 'cron') {
  const startedAt = new Date().toISOString();
  let tasksScanned = 0;
  let pendingCount = 0;
  let status = 'SUCCESS';
  let detail = '';

  try {
    const resp = await fetch(`${TASK_SERVICE_URL}/api/tasks`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) throw new Error(`task-service HTTP ${resp.status}`);
    const tasks = await resp.json();
    tasksScanned = tasks.length;
    pendingCount = tasks.filter((t) => t.status !== 'DONE').length;
    detail = `Scanned ${tasksScanned} tasks (${pendingCount} pending)`;

    const eventPayload = {
      type: 'SCHEDULER_DIGEST',
      title: 'Scheduled Task Reminder Sweep',
      message: detail,
      source: 'scheduler-service',
      timestamp: new Date().toISOString(),
    };

    if (redis && redisReady) {
      await redis.publish('taskflow:events', JSON.stringify(eventPayload));
    } else {
      await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
    }

    await fetch(`${AUDIT_SERVICE_URL}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: `scheduler-service (${triggerSource})`,
        action: 'SWEEP_COMPLETED',
        resource: 'tasks',
        details: detail,
      }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } catch (err) {
    status = 'DEGRADED';
    detail = err.message;
  }

  const record = {
    id: `job-${Date.now()}`,
    jobName: 'pending-task-digest',
    triggerSource,
    status,
    tasksScanned,
    pendingCount,
    detail,
    executedAt: startedAt,
  };
  jobHistory.unshift(record);
  if (jobHistory.length > 20) jobHistory.pop();
  return record;
}

const timer = setInterval(() => {
  runDigestJob('cron').catch(() => {});
}, CRON_INTERVAL_MS);

app.get('/health', (_req, res) => {
  res.json({
    status: 'UP',
    service: 'scheduler-service',
    language: 'Node.js',
    intervalMs: CRON_INTERVAL_MS,
    redis: redisReady ? 'CONNECTED' : 'HTTP_FALLBACK',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/scheduler/jobs', (_req, res) => {
  res.json({
    intervalMs: CRON_INTERVAL_MS,
    totalRuns: jobHistory.length,
    jobs: jobHistory,
  });
});

app.post('/api/scheduler/trigger', async (_req, res) => {
  const result = await runDigestJob('manual');
  res.json(result);
});

const server = app.listen(PORT, () => {
  console.log(`scheduler-service listening on port ${PORT} (interval ${CRON_INTERVAL_MS}ms)`);
  setTimeout(() => runDigestJob('startup').catch(() => {}), 3000);
});

const shutdown = () => {
  clearInterval(timer);
  server.close(async () => {
    if (redis) await redis.quit().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

