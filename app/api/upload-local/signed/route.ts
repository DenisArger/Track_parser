import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { loadConfig } from "@/lib/config";
import { setTrack, generateTrackId } from "@/lib/storage/trackStorage";
import { sanitizeFilenameForStorage, STORAGE_BUCKETS } from "@/lib/storage/supabaseStorage";
import type { Track } from "@/types/track";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as
      | { filename?: string; contentType?: string }
      | null;

    const originalFilename = body?.filename?.trim() || "";
    const contentType = body?.contentType || "audio/mpeg";

    if (!originalFilename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    const config = await loadConfig();
    const trackId = generateTrackId();
    const safeFilename = sanitizeFilenameForStorage(originalFilename);
    const storagePath = `${trackId}/${safeFilename}`;

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.downloads)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      const message = error?.message || "Failed to create signed upload URL";
      console.error("Signed upload URL error:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const filename = safeFilename;
    const title = filename.replace(/\.[^.]+$/, "");

    const track: Track = {
      id: trackId,
      filename,
      originalPath: storagePath,
      metadata: {
        title: title || "Unknown",
        artist: "Unknown",
        album: "Unknown",
        genre: "Средний",
        rating: config.processing.defaultRating,
        year: config.processing.defaultYear,
      },
      status: "downloading",
    };

    await setTrack(trackId, track);

    return NextResponse.json({
      ok: true,
      trackId,
      storagePath,
      contentType,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Signed local upload error:", message);
    return NextResponse.json(
      { error: `Signed local upload failed: ${message}` },
      { status: 500 }
    );
  }
}
