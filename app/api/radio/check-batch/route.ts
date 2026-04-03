import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getRadioTrackNamesSet } from "@/lib/radio/radioTracks";
import { checkTracksOnRadio } from "@/lib/radio/streamingCenterClient";
import { getTrack as getStoredTrack, setTrack } from "@/lib/storage/trackStorage";

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

    console.log("[radio check-batch] start", {
      userId: user.id,
      trackCount: items.length,
      trackIds: items.map((item) => item.id),
    });

    const radioSet = await getRadioTrackNamesSet();
    const onRadio = checkTracksOnRadio(items, radioSet);
    console.log("[radio check-batch] matched", onRadio);

    await Promise.all(
      Object.entries(onRadio)
        .filter(([, isOnRadio]) => isOnRadio)
        .map(async ([trackId]) => {
          try {
            console.log("[radio check-batch] persist status start", { trackId });
            const track = await getStoredTrack(trackId);
            if (!track) {
              console.warn("[radio check-batch] track not found in tracks", {
                trackId,
              });
              return;
            }
            if (track.status !== "uploaded_radio") {
              track.status = "uploaded_radio";
              await setTrack(trackId, track);
              console.log("[radio check-batch] persist status done", { trackId });
            } else {
              console.log("[radio check-batch] already uploaded_radio", { trackId });
            }
          } catch (trackError) {
            const trackErrorMessage =
              trackError instanceof Error ? trackError.message : String(trackError);
            console.error("[radio check-batch] persist status failed", {
              trackId,
              error: trackErrorMessage,
            });
          }
        })
    );

    console.log("[radio check-batch] done", {
      matchedCount: Object.values(onRadio).filter(Boolean).length,
    });
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
