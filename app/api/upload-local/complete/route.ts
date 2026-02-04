import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getTrack, setTrack } from "@/lib/storage/trackStorage";
import { fileExistsInStorage, STORAGE_BUCKETS } from "@/lib/storage/supabaseStorage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as
      | { trackId?: string }
      | null;

    const trackId = body?.trackId?.trim() || "";
    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }

    const track = await getTrack(trackId);
    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    if (!track.originalPath) {
      return NextResponse.json({ error: "Track has no original path" }, { status: 400 });
    }

    const exists = await fileExistsInStorage(
      STORAGE_BUCKETS.downloads,
      track.originalPath
    );

    if (!exists) {
      return NextResponse.json(
        { error: "Uploaded file not found in Storage" },
        { status: 400 }
      );
    }

    track.status = "downloaded";
    await setTrack(trackId, track);

    return NextResponse.json({ ok: true, trackId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Complete local upload error:", message);
    return NextResponse.json(
      { error: `Complete local upload failed: ${message}` },
      { status: 500 }
    );
  }
}
