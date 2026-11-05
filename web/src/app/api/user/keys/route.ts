import { encryptKey } from "@/lib/api/encryption";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST: Lưu và mã hóa BYOK
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

        const { error } = await supabase.from('zc_users_api_keys').upsert({
            encrypted_key: encryptedKey,
            is_valid: true,
            user_id: user.id,
            provider_id: providerId,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id, provider_id'
        });

        if (error) {
            console.error('Save API key error: ', error);

            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true }, {status: 200});
    } catch (error: unknown) {
        console.error("POST /api/user/keys error:", error);

        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// GET: Trả về các provider đã gắn BYOK của người dùng hiện tại
export async function GET() {
    try {
        const supabase = await createClient();

        const { data: {user} } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('zc_users_api_keys')
            .select(`
                provider_id,
                is_valid,
                updated_at,
                `)
            .eq('user_id', user.id);

        if (error){
            console.error('Get API key error: ', error);

            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, keys: data ?? [] }, {status: 200});
    } catch (error: unknown) {
        console.error("GET /api/user/keys error:", error);

        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE: Xóa API key của một provider
export async function DELETE(req: Request) {
  try {
    const { providerId } = await req.json();

    if (typeof providerId !== "string" || !providerId.trim()) {
      return NextResponse.json({ error: "Missing or invalid providerId" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Kiểm tra đăng nhập
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Kiểm tra API key có thuộc người dùng và provider này không
    const { data: existingKey, error: findError } = await supabase
      .from("zc_users_api_keys")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider_id", providerId.trim())
      .maybeSingle();

    if (findError) {
      console.error("Find API key error:", findError);

      return NextResponse.json(
        { error: "Could not verify API key" },
        { status: 500 }
      );
    }

    if (!existingKey) {
      return NextResponse.json(
        { error: "API key not found for this provider" },
        { status: 404 }
      );
    }

    // 3. Xóa API key
    const { error: deleteError } = await supabase
      .from("zc_user_api_keys")
      .delete()
      .eq("id", existingKey.id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Delete API key error:", deleteError);

      return NextResponse.json(
        { error: "Could not delete API key" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error("DELETE /api/user/keys error:", error);

    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}