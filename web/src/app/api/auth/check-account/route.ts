import { getUser } from '@/lib/store/account';

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ exists: false }, { status: 400 });
  }
  const user = await getUser(email).catch(() => null);
  return Response.json({ exists: Boolean(user) });
}
