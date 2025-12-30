import { NextRequest, NextResponse } from "next/server";
import { getTrack } from "@/lib/processTracks";
// Dynamic imports to avoid issues in serverless
// import fs from "fs-extra";
// import path from "path";
import { handleApiError, handleNotFoundError } from "@/lib/api/errorHandler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    // Dynamic imports to avoid issues in serverless
    const fs = await import("fs-extra");
    const path = await import("path");
    
    const { trackId } = await params;
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

    // Normalize path - trim leading/trailing spaces from filename
    // This handles cases where yt-dlp saves files with spaces in filename
    const pathParts = filePath.split(path.sep);
    const filename = pathParts[pathParts.length - 1];
    const dirPath = pathParts.slice(0, -1).join(path.sep);
    const normalizedFilename = filename.trim();
    const normalizedPath = path.join(dirPath, normalizedFilename);

    // Try original path first, then normalized path
    let fileExists = await fs.pathExists(filePath);
    let actualFilePath = filePath;
    
    if (!fileExists && normalizedPath !== filePath) {
      fileExists = await fs.pathExists(normalizedPath);
      if (fileExists) {
        actualFilePath = normalizedPath;
      }
    }

    if (!fileExists) {
      console.log("File does not exist at path:", filePath);

      // Try to find the file in downloads directory with a different name
      // Use safe working directory for serverless
      const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");
      const workingDir = getSafeWorkingDirectory();
      const downloadsDir = path.join(workingDir, "downloads");
      
      try {
        // Ensure directory exists (it might not exist in new serverless invocation)
        await fs.ensureDir(downloadsDir);
        
        const dirExists = await fs.pathExists(downloadsDir);
        
        if (!dirExists) {
          throw new Error(`Downloads directory does not exist: ${downloadsDir}`);
        }
        
        let files: string[] = [];
        try {
          files = await fs.readdir(downloadsDir);
        } catch (readError) {
          throw readError;
        }
        
        const mp3Files = files.filter((file) => file.endsWith(".mp3"));

        if (mp3Files.length > 0) {
          // Try to find exact match first (normalized), then use first available
          const trimmedFilename = track.filename.trim();
          let fallbackFile = mp3Files.find(f => {
            const normalizedF = f.trim();
            return normalizedF === trimmedFilename || 
                   normalizedF.toLowerCase() === trimmedFilename.toLowerCase() ||
                   f.includes(trimmedFilename) || 
                   trimmedFilename.includes(normalizedF);
          });
          if (!fallbackFile) {
            fallbackFile = mp3Files[0];
          }
          
          const fallbackPath = path.join(downloadsDir, fallbackFile);
          console.log("Using fallback file:", fallbackPath);

          const fileStats = await fs.stat(fallbackPath);
          const fileSize = fileStats.size;
          const fileName = path.basename(fallbackPath);
          const encodedFileName = encodeURIComponent(fileName);

          // Check for Range header to support seeking
          const rangeHeader = request.headers.get("range");
          
          if (rangeHeader) {
            // Parse range header (e.g., "bytes=0-1023" or "bytes=1024-")
            const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            
            if (rangeMatch) {
              const start = parseInt(rangeMatch[1], 10);
              const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
              const chunkSize = end - start + 1;
              
              // Validate range
              if (start >= 0 && start < fileSize && end < fileSize && start <= end) {
                // Read only the requested chunk using native fs.promises
                const nativeFs = await import("fs/promises");
                const fileHandle = await nativeFs.open(fallbackPath, "r");
                try {
                  const buffer = Buffer.alloc(chunkSize);
                  await fileHandle.read(buffer, 0, chunkSize, start);
                  
                  return new NextResponse(buffer, {
                    status: 206, // Partial Content
                    headers: {
                      "Content-Type": "audio/mpeg",
                      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                      "Accept-Ranges": "bytes",
                      "Content-Length": chunkSize.toString(),
                      "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
                    },
                  });
                } finally {
                  await fileHandle.close();
                }
              }
            }
          }

          // No range header or invalid range - return full file
          const fileBuffer = await fs.readFile(fallbackPath);

          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
              "Content-Length": fileSize.toString(),
              "Accept-Ranges": "bytes",
            },
          });
        }
      } catch (error) {
        console.log("Error reading downloads directory:", error);
      }

      // In serverless, files in /tmp are not persistent between function invocations
      // Try to re-download the file if we have the source URL
      const isServerless = typeof process !== 'undefined' && !!process.env.NETLIFY;
      const sourceUrl = track.metadata.sourceUrl;
      const sourceType = track.metadata.sourceType;
      
      if (isServerless && sourceUrl && sourceType) {
        try {
          console.log(`[SERVERLESS] Re-downloading track ${trackId} from ${sourceUrl}`);
          
          // Re-download the file
          const { loadConfig } = await import("@/lib/config");
          const config = await loadConfig();
          
          let downloadResult: { filePath: string; title: string };
          
          if (sourceType === "youtube" || sourceType === "youtube-music") {
            const { downloadTrackViaRapidAPI } = await import("@/lib/download/youtubeDownloader");
            downloadResult = await downloadTrackViaRapidAPI(sourceUrl, config.folders.downloads);
          } else if (sourceType === "yandex") {
            // Yandex downloads are not supported in serverless, skip
            throw new Error("Yandex downloads not supported in serverless");
          } else {
            throw new Error(`Unknown source type: ${sourceType}`);
          }
          
          // Normalize the filename (remove leading/trailing spaces)
          const normalizedDownloadPath = downloadResult.filePath;
          const pathParts = normalizedDownloadPath.split(path.sep);
          const downloadFilename = pathParts[pathParts.length - 1];
          const downloadDir = pathParts.slice(0, -1).join(path.sep);
          const normalizedDownloadFilename = downloadFilename.trim();
          const finalPath = path.join(downloadDir, normalizedDownloadFilename);
          
          // Rename if needed
          if (normalizedDownloadPath !== finalPath) {
            await fs.move(normalizedDownloadPath, finalPath, { overwrite: true });
          }
          
          // Update track with new path
          track.originalPath = finalPath;
          
          // Now serve the file
          const fileStats = await fs.stat(finalPath);
          const fileSize = fileStats.size;
          const fileName = path.basename(finalPath);
          const encodedFileName = encodeURIComponent(fileName);
          
          // Check for Range header
          const rangeHeader = request.headers.get("range");
          
          if (rangeHeader) {
            const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            
            if (rangeMatch) {
              const start = parseInt(rangeMatch[1], 10);
              const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
              const chunkSize = end - start + 1;
              
              if (start >= 0 && start < fileSize && end < fileSize && start <= end) {
                const nativeFs = await import("fs/promises");
                const fileHandle = await nativeFs.open(finalPath, "r");
                try {
                  const buffer = Buffer.alloc(chunkSize);
                  await fileHandle.read(buffer, 0, chunkSize, start);
                  
                  return new NextResponse(buffer, {
                    status: 206,
                    headers: {
                      "Content-Type": "audio/mpeg",
                      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                      "Accept-Ranges": "bytes",
                      "Content-Length": chunkSize.toString(),
                      "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
                    },
                  });
                } finally {
                  await fileHandle.close();
                }
              }
            }
          }
          
          // Return full file
          const fileBuffer = await fs.readFile(finalPath);
          
          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
              "Content-Length": fileSize.toString(),
              "Accept-Ranges": "bytes",
            },
          });
        } catch (reDownloadError) {
          console.error(`[SERVERLESS] Failed to re-download track ${trackId}:`, reDownloadError);
        }
      }
      
      return handleNotFoundError(
        isServerless 
          ? "Audio file not found. In serverless environments, files are not persistent between requests. The file will be re-downloaded automatically if the source URL is available."
          : "Audio file not found"
      );
    }

    console.log("File exists, serving audio...");

    const fileStats = await fs.stat(actualFilePath);
    const fileSize = fileStats.size;
    const fileName = path.basename(filePath);
    const encodedFileName = encodeURIComponent(fileName);

    // Check for Range header to support seeking
    const rangeHeader = request.headers.get("range");
    
    if (rangeHeader) {
      // Parse range header (e.g., "bytes=0-1023" or "bytes=1024-")
      const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        
        // Validate range
        if (start >= 0 && start < fileSize && end < fileSize && start <= end) {
          // Read only the requested chunk using native fs.promises
          const nativeFs = await import("fs/promises");
          const fileHandle = await nativeFs.open(actualFilePath, "r");
          try {
            const buffer = Buffer.alloc(chunkSize);
            await fileHandle.read(buffer, 0, chunkSize, start);
            
            return new NextResponse(buffer, {
              status: 206, // Partial Content
              headers: {
                "Content-Type": "audio/mpeg",
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize.toString(),
                "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
              },
            });
          } finally {
            await fileHandle.close();
          }
        }
      }
    }

    // No range header or invalid range - return full file
    const fileBuffer = await fs.readFile(actualFilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to serve audio file");
  }
}
