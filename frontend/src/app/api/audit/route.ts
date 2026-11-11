import { NextRequest } from 'next/server';
import { getServiceUrls, proxyJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyJson(`${getServiceUrls().audit}/api/audit`, 'audit-service');
}

export async function POST(req: NextRequest) {
  return proxyJson(`${getServiceUrls().audit}/api/audit`, 'audit-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await req.text(),
  });
}
