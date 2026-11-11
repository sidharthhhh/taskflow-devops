import { NextResponse } from 'next/server';
import { getServiceUrls } from '@/lib/services';

export const dynamic = 'force-dynamic';

interface ServiceProbe {
  id: string;
  name: string;
  language: string;
  port: number;
  url: string;
}

export async function GET() {
  const urls = getServiceUrls();
  const probes: ServiceProbe[] = [
    { id: 'task', name: 'Task Service', language: 'Java 17', port: 8080, url: `${urls.task}/actuator/health` },
    { id: 'auth', name: 'Auth Service', language: 'Node.js', port: 3001, url: `${urls.auth}/health` },
    { id: 'analytics', name: 'Analytics Service', language: 'Node.js', port: 3002, url: `${urls.analytics}/health` },
    { id: 'scheduler', name: 'Scheduler Service', language: 'Node.js', port: 3003, url: `${urls.scheduler}/health` },
    { id: 'notification', name: 'Notification Service', language: 'Golang', port: 8081, url: `${urls.notification}/health` },
    { id: 'audit', name: 'Audit Logs Service', language: 'Rust', port: 8082, url: `${urls.audit}/health` },
  ];

  const results = await Promise.all(
    probes.map(async (p) => {
      const started = Date.now();
      try {
        const res = await fetch(p.url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(2000),
        });
        const latencyMs = Date.now() - started;
        const data = await res.json().catch(() => ({}));
        return {
          id: p.id,
          name: p.name,
          language: p.language,
          port: p.port,
          status: res.ok ? 'UP' : 'DEGRADED',
          latencyMs,
          redis: data.redis || null,
          database: data.database || null,
        };
      } catch {
        return {
          id: p.id,
          name: p.name,
          language: p.language,
          port: p.port,
          status: 'DOWN',
          latencyMs: Date.now() - started,
          redis: null,
          database: null,
        };
      }
    })
  );

  return NextResponse.json({
    frontend: 'UP',
    services: results,
    timestamp: new Date().toISOString(),
  });
}

