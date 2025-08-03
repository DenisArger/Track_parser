import { NextRequest, NextResponse } from "next/server";
import { processTrack } from "@/lib/processTracks";
import { ProcessingRequest, TrackMetadata } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body: ProcessingRequest = await request.json();
    const { trackId, metadata, trimSettings } = body;

    console.log("Processing track request:", {
      trackId,
      metadata,
      trimSettings,
    });

    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }

    const track = await processTrack(
      trackId,
      metadata as TrackMetadata | undefined,
      trimSettings
    );

    console.log("Track processed successfully:", track.id);

    return NextResponse.json({
      success: true,
      track,
      message: "Track processed successfully",
    });
  } catch (error) {
    console.error("Processing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Processing failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
