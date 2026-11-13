import { getUser } from '@/lib/store/account';

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ exists: false }, { status: 400 });
  }
  
  try {
    const user = await getUser(email);
    
    return Response.json({ exists: Boolean(user) });
  } catch (error) {
    console.error('[check-account] Error:', error);

    return Response.json(
      { error: 'Failed to check account' },
      { status: 500 }
    );
  }
}
