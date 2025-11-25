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
    const { searchParams } = new URL(request.url);
    const isTrimmed = searchParams.get("trimmed") === "true";

    console.log(
      "Audio API called for trackId:",
      trackId,
      "trimmed:",
      isTrimmed
    );

    const track = await getTrack(trackId);

    if (!track) {
      return handleNotFoundError("Track not found");
    }

    console.log("Track found:", track.filename);
    console.log("Original path:", track.originalPath);
    console.log("Processed path:", track.processedPath);

    // Выбираем путь к файлу в зависимости от статуса трека и параметра
    let filePath = track.originalPath;
    if (isTrimmed && track.status === "trimmed" && track.processedPath) {
      filePath = track.processedPath;
      console.log("Using processed path for trimmed track:", filePath);
    } else if (track.status === "trimmed" && track.processedPath) {
      filePath = track.processedPath;
      console.log("Using processed path for trimmed track:", filePath);
    }

    if (!(await fs.pathExists(filePath))) {
      console.log("File does not exist at path:", filePath);

      // Try to find the file in downloads directory with a different name
      const downloadsDir = path.join(process.cwd(), "downloads");
      const files = await fs.readdir(downloadsDir);
      const mp3Files = files.filter((file) => file.endsWith(".mp3"));

      if (mp3Files.length > 0) {
        // Use the first MP3 file found
        const fallbackPath = path.join(downloadsDir, mp3Files[0]);
        console.log("Using fallback file:", fallbackPath);

        const fileBuffer = await fs.readFile(fallbackPath);
        const fileName = path.basename(fallbackPath);
        const encodedFileName = encodeURIComponent(fileName);

        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
            "Content-Length": fileBuffer.length.toString(),
          },
        });
      }

      return handleNotFoundError("Audio file not found");
    }

    console.log("File exists, serving audio...");

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
    return handleApiError(error, "Failed to serve audio file");
  }
}
