import { NextRequest, NextResponse } from 'next/server';
import { emitTaskEvent, getServiceUrls, proxyJson, safeJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const urls = getServiceUrls();
  const status = req.nextUrl.searchParams.get('status');
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return proxyJson(`${urls.task}/api/tasks${query}`, 'task-service');
}

export async function POST(req: NextRequest) {
  const urls = getServiceUrls();
  try {
    const body = await req.json();
    const actor = req.headers.get('x-actor') || 'workspace-user';
    const res = await fetch(`${urls.task}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4500),
    });
    const data = await safeJson(res);
    if (res.ok) {
      await emitTaskEvent({
        actor,
        action: 'TASK_CREATED',
        resource: `task/${data.id}`,
        title: 'Task Created',
        message: `Created "${data.title}" (${data.status})`,
      });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'task-service unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
