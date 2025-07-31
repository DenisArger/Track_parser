import { NextRequest, NextResponse } from "next/server";
import { getTrack } from "@/lib/processTracks";
import { TrackMetadata } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, metadata } = body;

    if (!trackId || !metadata) {
      return NextResponse.json(
        { error: "Track ID and metadata are required" },
        { status: 400 }
      );
    }

    const track = await getTrack(trackId);
    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Update track metadata
    Object.assign(track.metadata, metadata);

    return NextResponse.json({
      success: true,
      track,
      message: "Metadata updated successfully",
    });
  } catch (error) {
    console.error("Metadata update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update metadata",
        success: false,
      },
      { status: 500 }
    );
  }
}
