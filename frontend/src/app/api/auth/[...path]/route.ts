import { NextRequest } from 'next/server';
import { getServiceUrls, proxyJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

async function forwardAuth(req: NextRequest, path: string[]) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  return proxyJson(`${getServiceUrls().auth}/api/auth/${path.join('/')}`, 'auth-service', {
    method: req.method,
    headers,
    body: req.method === 'GET' ? undefined : await req.text(),
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forwardAuth(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forwardAuth(req, params.path);
}
