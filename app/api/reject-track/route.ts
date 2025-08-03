import { NextRequest, NextResponse } from "next/server";
import { rejectTrack } from "@/lib/processTracks";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId } = body;

    console.log("Rejecting track request:", { trackId });

    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }

    await rejectTrack(trackId);

    console.log("Track rejected successfully:", trackId);

    return NextResponse.json({
      success: true,
      message: "Track rejected successfully",
    });
  } catch (error) {
    console.error("Reject error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reject track",
        success: false,
      },
      { status: 500 }
    );
  }
}
