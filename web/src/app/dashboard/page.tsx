import { redirect } from 'next/navigation';
import Dashboard from './dashboard';
import { createClient } from '@/lib/supabase/server';

// The proxy is not enough by itself to protect and redirect
export default async function DashboardPage () {
    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        redirect('/auth');
    }

    if (user.user_metadata?.has_password !== true) {
        redirect('/auth');
    }

    return <Dashboard />
};
