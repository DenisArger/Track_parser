import { NextResponse } from "next/server";
import { deleteTrackAction } from "@/lib/actions/trackActions";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trackId?: string | string[] }> }
) {
  try {
    const resolvedParams = await params;
    const rawId = Array.isArray(resolvedParams?.trackId)
      ? resolvedParams?.trackId[0]
      : resolvedParams?.trackId;
    const trackId = rawId ? decodeURIComponent(rawId) : "";
    if (!trackId || trackId === "undefined" || trackId === "null") {
      return NextResponse.json({ error: "Track ID is required" }, { status: 400 });
    }

    await deleteTrackAction(trackId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Delete track error:", message);
    return NextResponse.json(
      { error: `Delete failed: ${message}` },
      { status: 500 }
    );
  }
}
