import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DELETE ALL: Xóa hết API key của người dùng
export async function DELETE(req: Request) {
    try {
        const supabase = await createClient();

        const { data: {user} } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { error } = await supabase
            .from('zc_users_api_keys')
            .delete()
            .eq('user_id', user.id);

        if (error) {
            return NextResponse.json({ error: 'Could not delete API keys' }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: unknown) {
        console.error("DELETE ALL /api/user/keys/all error:", error);
        
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}