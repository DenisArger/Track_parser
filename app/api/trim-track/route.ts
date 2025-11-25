import { NextRequest, NextResponse } from "next/server";
import { trimTrack } from "@/lib/processTracks";
import { TrimSettings } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      trackId,
      trimSettings,
    }: { trackId: string; trimSettings: TrimSettings } = body;

    console.log("Trim track request:", { trackId, trimSettings });

    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }

    if (!trimSettings) {
      return NextResponse.json(
        { error: "Trim settings are required" },
        { status: 400 }
      );
    }

    const track = await trimTrack(trackId, trimSettings);

    console.log("Track trimmed successfully:", track.id);

    return NextResponse.json({
      success: true,
      track,
      message: "Track trimmed successfully",
    });
  } catch (error) {
    console.error("Trim error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Trim failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
