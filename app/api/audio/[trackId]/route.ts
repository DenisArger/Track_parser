import { NextRequest, NextResponse } from "next/server";
import { getTrack } from "@/lib/processTracks";
import { handleApiError, handleNotFoundError } from "@/lib/api/errorHandler";
import { getAuthUser } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { trackId } = await params;
    const { searchParams } = new URL(request.url);
    const isTrimmed = searchParams.get("trimmed") === "true";
    const forceProcessed = searchParams.get("processed") === "true";

    const track = await getTrack(trackId);
    if (!track) return handleNotFoundError("Track not found");

    let filePath = track.originalPath;
    let bucket: string = "downloads";
    if (forceProcessed && track.processedPath) {
      filePath = track.processedPath;
      bucket = "processed";
    } else if ((isTrimmed && track.status === "trimmed") || track.status === "trimmed") {
      if (track.processedPath) {
        filePath = track.processedPath;
        bucket = "processed";
      }
    } else if (track.status === "rejected") {
      bucket = "rejected";
    }

    if (!filePath) {
      return handleNotFoundError("Audio file not found");
    }

    const {
      createSignedUrl,
      downloadFileFromStorage,
      STORAGE_BUCKETS,
    } = await import("@/lib/storage/supabaseStorage");

    let storageBucket: string = STORAGE_BUCKETS.downloads;
    if (bucket === "processed" || filePath.startsWith("processed/")) storageBucket = STORAGE_BUCKETS.processed;
    else if (bucket === "rejected" || filePath.startsWith("rejected/")) storageBucket = STORAGE_BUCKETS.rejected;
    let storagePath = filePath;
    if (storagePath.startsWith("downloads/")) storagePath = storagePath.replace("downloads/", "");
    else if (storagePath.startsWith("processed/")) storagePath = storagePath.replace("processed/", "");
    else if (storagePath.startsWith("rejected/")) storagePath = storagePath.replace("rejected/", "");

    const rangeHeader = request.headers.get("range");

    const serveFromBuffer = (fileBuffer: Buffer, fileName: string) => {
      const fileSize = fileBuffer.length;
      const encoded = encodeURIComponent(fileName);
      if (rangeHeader) {
        const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (m) {
          const start = parseInt(m[1], 10);
          const end = m[2] ? parseInt(m[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          if (start >= 0 && start < fileSize && end < fileSize && start <= end) {
            const chunk = new Uint8Array(fileBuffer.slice(start, end + 1));
            return new NextResponse(chunk, {
              status: 206,
              headers: {
                "Content-Type": "audio/mpeg",
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": String(chunkSize),
                "Content-Disposition": `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`,
              },
            });
          }
        }
      }
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
        },
      });
    };

    try {
      const signedUrl = await createSignedUrl(storageBucket, storagePath, 3600);
      return NextResponse.redirect(signedUrl);
    } catch (storageError) {
      console.error("Error accessing Storage:", storageError);
      if (rangeHeader) {
        try {
          const fileBuffer = await downloadFileFromStorage(storageBucket, storagePath);
          return serveFromBuffer(fileBuffer, track.filename);
        } catch (bufferError) {
          console.error("Error downloading file buffer:", bufferError);
        }
      }
    }

    // Re-download to Storage (serverless only) and serve
    const { isServerlessEnvironment } = await import("@/lib/utils/environment");
    const isServerless = isServerlessEnvironment();
    const sourceUrl = track.metadata.sourceUrl;
    const sourceType = track.metadata.sourceType;
    if (isServerless && sourceUrl && (sourceType === "youtube" || sourceType === "youtube-music")) {
      try {
        const { loadConfig } = await import("@/lib/config");
        const { downloadTrackViaRapidAPI } = await import("@/lib/download/youtubeDownloader");
        const { setTrack } = await import("@/lib/storage/trackStorage");
        const config = await loadConfig();
        const result = await downloadTrackViaRapidAPI(sourceUrl, config.folders.downloads, trackId);
        track.originalPath = result.storagePath;
        await setTrack(trackId, track);
        const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.downloads, result.storagePath);
        return serveFromBuffer(fileBuffer, track.filename);
      } catch (reDownloadError) {
        console.error("[SERVERLESS] Re-download failed:", reDownloadError);
      }
    }

    return handleNotFoundError(
      isServerless
        ? "Audio file not found. In serverless, files are not persistent. Re-download is only available for YouTube/YouTube Music with a saved source URL."
        : "Audio file not found"
    );
  } catch (error) {
    return handleApiError(error, "Failed to serve audio file");
  }
}
