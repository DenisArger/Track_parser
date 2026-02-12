import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "den.arger@gmail.com";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = (user.email || "").toLowerCase();
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("radio_tracks")
      .select("id, raw_name, artist, title, track_type, year, rating, created_at")
      .order("created_at", { ascending: false, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ tracks: data ?? [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
