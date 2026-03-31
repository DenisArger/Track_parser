import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

type UserIdentity = {
  id?: string;
};

async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.role === "string" ? data.role : null;
}

export async function isAdminUser(
  supabase: SupabaseClient,
  user: UserIdentity | null | undefined
): Promise<boolean> {
  const userId = user?.id;
  if (!userId) return false;
  const role = await getUserRole(supabase, userId);
  return role === "admin";
}

export async function isAdminUserClient(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  return isAdminUser(getSupabase(), { id: userId });
}
