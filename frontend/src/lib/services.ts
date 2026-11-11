import { NextResponse } from 'next/server';

export function getServiceUrls() {
  return {
    task: (process.env.TASK_SERVICE_URL || 'http://localhost:8080').replace(/\/$/, ''),
    auth: (process.env.AUTH_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, ''),
    analytics: (process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, ''),
    scheduler: (process.env.SCHEDULER_SERVICE_URL || 'http://localhost:3003').replace(/\/$/, ''),
    notification: (process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8081').replace(/\/$/, ''),
    audit: (process.env.AUDIT_SERVICE_URL || 'http://localhost:8082').replace(/\/$/, ''),
  };
}

export async function safeJson(res: Response) {
  return res.json().catch(() => ({ error: `Upstream returned HTTP ${res.status}` }));
}

export async function proxyJson(url: string, serviceName: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });
    const data = await safeJson(res);
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `${serviceName} unavailable`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function emitTaskEvent(params: {
  actor: string;
  action: string;
  resource: string;
  title: string;
  message: string;
}) {
  const urls = getServiceUrls();

  await Promise.allSettled([
    fetch(`${urls.audit}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: params.actor,
        action: params.action,
        resource: params.resource,
        details: params.message,
      }),
      signal: AbortSignal.timeout(2000),
    }),
    fetch(`${urls.notification}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: params.action,
        title: params.title,
        message: params.message,
        source: 'task-service',
      }),
      signal: AbortSignal.timeout(2000),
    }),
  ]);
}
