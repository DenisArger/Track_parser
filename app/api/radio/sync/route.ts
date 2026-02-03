import { NextResponse } from "next/server";
import { syncRadioTracksFromApi } from "@/lib/radio/radioTracks";

export async function POST() {
  try {
    const { count } = await syncRadioTracksFromApi();
    if (count === 0) {
      console.warn(
        "Radio sync: 0 tracks from API. Check STREAMING_CENTER_API_URL, STREAMING_CENTER_PLAYLIST_ID and that the playlist has tracks (filename/meta/public_path)."
      );
    } else {
      console.log("Radio sync: saved", count, "tracks to radio_tracks");
    }
    return NextResponse.json({ success: true, count });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Radio sync error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
