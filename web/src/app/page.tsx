import PrototypeApp from "@/prototype/App";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const headerList = await headers();
  const referer = headerList.get("referer") || "";
  const isFromInsideDashboard = referer.includes("/dashboard") || params.from === "dashboard";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Cách 1: Đã đăng nhập và không phải bấm về từ dashboard -> chuyển thẳng sang dashboard từ server
  if (user?.email && !isFromInsideDashboard) {
    redirect("/dashboard");
  }

  return <PrototypeApp />;
}
