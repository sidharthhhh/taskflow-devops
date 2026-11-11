import { NextRequest, NextResponse } from 'next/server';
import { emitTaskEvent, getServiceUrls, safeJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const urls = getServiceUrls();
  try {
    const body = await req.json();
    const actor = req.headers.get('x-actor') || 'workspace-user';
    const res = await fetch(`${urls.task}/api/tasks/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4500),
    });
    const data = await safeJson(res);
    if (res.ok) {
      await emitTaskEvent({
        actor,
        action: 'TASK_UPDATED',
        resource: `task/${params.id}`,
        title: 'Task Updated',
        message: `Updated "${data.title}" -> ${data.status}`,
      });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'task-service unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const urls = getServiceUrls();
  try {
    const actor = req.headers.get('x-actor') || 'workspace-user';
    const res = await fetch(`${urls.task}/api/tasks/${params.id}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      await emitTaskEvent({
        actor,
        action: 'TASK_DELETED',
        resource: `task/${params.id}`,
        title: 'Task Deleted',
        message: `Removed task #${params.id}`,
      });
      return new NextResponse(null, { status: 204 });
    }
    const data = await safeJson(res);
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'task-service unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
