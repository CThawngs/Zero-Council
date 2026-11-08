import { redirect } from "next/navigation";
import PrototypeApp from "@/prototype/App";
import { createClient } from "@/lib/supabase/server";
import { hasPasswordClaim } from "@/lib/auth-password";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // A returning signed-in user (session cookie survived the browser close) is
  // mounted straight into the dashboard, never shown the marketing landing.
  // Google-only accounts without a password must create one first.
  if (user?.email) {
    if (!hasPasswordClaim(user.user_metadata)) {
      redirect("/auth");
    }
    return (
      <PrototypeApp
        initialAuthUser={{ id: user.id, email: user.email.trim().toLowerCase() }}
      />
    );
  }

  return <PrototypeApp />;
}
