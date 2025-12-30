import { NextRequest, NextResponse } from "next/server";
// Dynamic imports to avoid issues in serverless
// import fs from "fs-extra";
// import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ previewId: string }> }
) {
  try {
    // Dynamic imports to avoid issues in serverless
    const fs = await import("fs-extra");
    const path = await import("path");
    
    const { previewId } = await params;
    console.log("Preview audio requested for:", previewId);

    const tempDir = path.join(process.cwd(), "temp");
    const previewPath = path.join(tempDir, `${previewId}.mp3`);

    if (!(await fs.pathExists(previewPath))) {
      console.log("Preview file not found:", previewPath);
      return NextResponse.json(
        { error: "Preview file not found" },
        { status: 404 }
      );
    }

    console.log("Serving preview file:", previewPath);
    const fileBuffer = await fs.readFile(previewPath);
    const fileName = path.basename(previewPath);
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Preview audio serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve preview audio file" },
      { status: 500 }
    );
  }
}
