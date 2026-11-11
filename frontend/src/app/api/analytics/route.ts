import { NextRequest } from 'next/server';
import { getServiceUrls, proxyJson } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const urls = getServiceUrls();
  const refresh = req.nextUrl.searchParams.get('refresh');
  const query = refresh ? `?refresh=${encodeURIComponent(refresh)}` : '';
  return proxyJson(`${urls.analytics}/api/analytics${query}`, 'analytics-service');
}
