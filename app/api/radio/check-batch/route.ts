import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getRadioTrackNamesSet } from "@/lib/radio/radioTracks";
import { checkTracksOnRadio } from "@/lib/radio/streamingCenterClient";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { tracks } = body ?? {};

    if (!Array.isArray(tracks)) {
      return NextResponse.json(
        { error: "tracks array is required" },
        { status: 400 }
      );
    }

    const items = tracks.map(
      (t: { id?: string; metadata?: { title?: string; artist?: string } }) => ({
        id: String(t?.id ?? ""),
        metadata: {
          title: t?.metadata?.title,
          artist: t?.metadata?.artist,
        },
      })
    );

    const radioSet = await getRadioTrackNamesSet();
    const onRadio = checkTracksOnRadio(items, radioSet);

    return NextResponse.json({ onRadio });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Radio check-batch error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 502 }
    );
  }
}
