import { NextRequest, NextResponse } from "next/server";
import { uploadToFtp } from "@/lib/processTracks";
import { UploadRequest } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const { trackId, ftpConfig } = body;

    if (!trackId || !ftpConfig) {
      return NextResponse.json(
        { error: "Track ID and FTP config are required" },
        { status: 400 }
      );
    }

    await uploadToFtp(trackId, ftpConfig);

    return NextResponse.json({
      success: true,
      message: "Track uploaded successfully",
    });
  } catch (error) {
    console.error("FTP upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "FTP upload failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
