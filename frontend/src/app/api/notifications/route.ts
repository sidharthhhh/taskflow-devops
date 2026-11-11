import { NextRequest } from 'next/server';
import { getServiceUrls, proxyJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyJson(`${getServiceUrls().notification}/api/notifications`, 'notification-service');
}

export async function POST(req: NextRequest) {
  return proxyJson(`${getServiceUrls().notification}/api/notifications`, 'notification-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await req.text(),
  });
}

export async function DELETE() {
  return proxyJson(`${getServiceUrls().notification}/api/notifications`, 'notification-service', {
    method: 'DELETE',
  });
}
