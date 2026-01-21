import { NextRequest } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createSupabaseAuthServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  redirect(next);
}
