import { adminOnly } from '@/lib/api/adminOnly';
import { listUsers } from '@/lib/store/account';

export async function GET() {
  const denied = await adminOnly();
  if (denied) return denied;
  try {
    return Response.json({ users: await listUsers() });
  } catch (error) {
    console.error('[admin] list users failed:', (error as Error).message);
    return Response.json({ error: 'LIST_FAILED' }, { status: 500 });
  }
}
