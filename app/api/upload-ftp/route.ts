import { NextRequest, NextResponse } from "next/server";
import { uploadTrackAction } from "@/lib/actions/trackActions";
import { FtpConfig } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, ftpConfig } = body;

    console.log("FTP upload API called:", { trackId, ftpConfig: { ...ftpConfig, password: "***" } });

    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }

    if (!ftpConfig || !ftpConfig.host || !ftpConfig.user) {
      return NextResponse.json(
        { error: "FTP configuration is required (host, user)" },
        { status: 400 }
      );
    }

    console.log("Calling uploadTrackAction...");
    await uploadTrackAction(trackId, ftpConfig as FtpConfig);
    console.log("uploadTrackAction completed successfully");

    return NextResponse.json({ success: true, message: "Track uploaded successfully" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("FTP upload error:", errorMessage);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}


