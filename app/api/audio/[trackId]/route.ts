import { NextRequest, NextResponse } from "next/server";
import { getTrack } from "@/lib/processTracks";
import fs from "fs-extra";
import path from "path";
import { handleApiError, handleNotFoundError } from "@/lib/api/errorHandler";

export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    const { trackId } = params;

    const track = await getTrack(trackId);

    if (!track) {
      return handleNotFoundError("Track not found");
    }

    const filePath = track.originalPath;

    if (!(await fs.pathExists(filePath))) {
      return handleNotFoundError("Audio file not found");
    }

    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to serve audio file");
  }
}
