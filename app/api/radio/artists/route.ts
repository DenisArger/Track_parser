import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("radio_tracks")
      .select("artist")
      .not("artist", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const unique = new Set<string>();
    for (const row of data || []) {
      const value = typeof row.artist === "string" ? row.artist.trim() : "";
      if (value) unique.add(value);
    }

    return NextResponse.json(
      {
        artists: Array.from(unique).sort((a, b) => a.localeCompare(b)),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
