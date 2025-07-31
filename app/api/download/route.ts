import { NextRequest, NextResponse } from "next/server";
import { downloadTrack } from "@/lib/processTracks";
import { DownloadRequest } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequest = await request.json();
    const { url, source } = body;

    if (!url || !source) {
      return NextResponse.json(
        { error: "URL and source are required" },
        { status: 400 }
      );
    }

    const track = await downloadTrack(url, source);

    return NextResponse.json({
      success: true,
      track,
      message: "Download started successfully",
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Download failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
