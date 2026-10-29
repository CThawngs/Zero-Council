import { encryptKey } from "@/lib/api/encryption";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Lưu và mã hóa BYOK
export async function POST(req: Request) {
    try {
        const { providerId, apiKey } = await req.json();

        if (!providerId || !apiKey)
            return NextResponse.json({ error: 'Missing providerId or apiKey' }, { status: 400 });

        const supabase = await createClient();
        const { data: {user} } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const encryptedKey = encryptKey(apiKey);

        const { error } = await supabase.from('zc_user_api_keys').upsert({
            encrypted_key: encryptedKey,
            is_valid: true,
            user_id: user.id,
            provider_id: providerId,
        }, {
            onConflict: 'user_id, provider_id'
        });

        if (error)
            return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message}, { status: 500 });
    }
}