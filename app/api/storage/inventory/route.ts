import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { STORAGE_BUCKETS, listStorageInventory } from "@/lib/storage/supabaseStorage";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buckets = [
      STORAGE_BUCKETS.downloads,
      STORAGE_BUCKETS.processed,
      STORAGE_BUCKETS.rejected,
      STORAGE_BUCKETS.previews,
      STORAGE_BUCKETS.serverUpload,
    ] as const;

    const inventory = await listStorageInventory(buckets);
    return NextResponse.json({
      buckets: inventory,
      totalFiles: inventory.reduce((sum, bucket) => sum + bucket.count, 0),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
