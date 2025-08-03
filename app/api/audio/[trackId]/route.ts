import { NextRequest, NextResponse } from "next/server";
import { getTrack } from "@/lib/processTracks";
import fs from "fs-extra";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    const { trackId } = params;

    const track = await getTrack(trackId);

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const filePath = track.originalPath;

    if (!(await fs.pathExists(filePath))) {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    // Кодируем имя файла для безопасного использования в заголовках
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Audio serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve audio file" },
      { status: 500 }
    );
  }
}
