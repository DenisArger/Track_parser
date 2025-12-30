import { NextRequest, NextResponse } from "next/server";
import { changeTrackStatusAction } from "@/lib/actions/trackActions";
import { TrackStatus } from "@/types/track";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses: TrackStatus[] = [
      "downloading",
      "downloaded",
      "processing",
      "processed",
      "trimmed",
      "rejected",
      "uploading",
      "uploaded",
      "error",
    ];

    if (!validStatuses.includes(status as TrackStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const track = await changeTrackStatusAction(trackId, status as TrackStatus);

    return NextResponse.json({ success: true, track });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Change track status error:", errorMessage);
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

