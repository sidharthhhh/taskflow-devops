import { NextRequest } from 'next/server';
import { getServiceUrls, proxyJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const target = `${getServiceUrls().scheduler}/api/scheduler/${params.path.join('/')}`;
  return proxyJson(target, 'scheduler-service');
}

export async function POST(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const target = `${getServiceUrls().scheduler}/api/scheduler/${params.path.join('/')}`;
  return proxyJson(target, 'scheduler-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
