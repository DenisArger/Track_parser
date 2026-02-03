// Dynamic imports to avoid issues during static generation
// import path from "path";
// import fs from "fs-extra";
import { Track, TrackMetadata, FtpConfig } from "@/types/track";
// Dynamic import to avoid issues during static generation
// import { loadConfig } from "./config";
import {
  generateTrackId,
  getAllTracks as getAllTracksFromStorage,
  getTrack as getTrackFromStorage,
  setTrack,
} from "./storage/trackStorage";
// Dynamic imports for modules that use spawn/exec to avoid issues in serverless
// These modules are only imported when needed, not at module load time
// import { detectBpm } from "./audio/bpmDetector"; // Moved to dynamic import
// import { writeTrackTags } from "./audio/metadataWriter"; // Moved to dynamic import
// import { uploadToFtp as uploadFileToFtp } from "./upload/ftpUploader"; // Moved to dynamic import
// Dynamic import to avoid issues during static generation
// import { isServerlessEnvironment } from "./utils/environment";

/**
 * РЎРєР°С‡РёРІР°РЅРёРµ С‚СЂРµРєР° С‡РµСЂРµР· yt-dlp (Р±РѕР»РµРµ РЅР°РґРµР¶РЅРѕ РґР»СЏ YouTube Music)
 */
export async function downloadTrackViaYtDlp(
  url: string,
  outputDir: string,
  trackId: string
): Promise<{ filePath: string; title: string }> {
  // Dynamic import to avoid issues during static generation
  const { isServerlessEnvironment } = await import("./utils/environment");
  
  // In serverless, spawn may not work - reject early with helpful message
  if (isServerlessEnvironment()) {
    throw new Error(
      "Downloading tracks via yt-dlp is not supported in serverless environment (Netlify). " +
        "This feature requires local file system access and process execution."
    );
  }

  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");
  const { spawn } = await import("child_process");
  const { findFfmpegPath } = await import("./utils/ffmpegFinder");

  await fs.ensureDir(outputDir);

  // РћС‡РёС‰Р°РµРј СЃС‚Р°СЂС‹Рµ С„Р°Р№Р»С‹ РїРµСЂРµРґ СЃРєР°С‡РёРІР°РЅРёРµРј РЅРѕРІРѕРіРѕ
  try {
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      if (
        file.endsWith(".mp3") ||
        file.endsWith(".webp") ||
        file.endsWith(".json")
      ) {
        await fs.remove(path.join(outputDir, file));
      }
    }
  } catch (error) {
    console.log("Error cleaning old files:", error);
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Get yt-dlp path (cross-platform)
      const { getYtDlpPath } = await import("./utils/ytDlpFinder");
      const ytDlpPath = await getYtDlpPath();

      if (!ytDlpPath) {
        reject(
          new Error(
            "yt-dlp not found. Please ensure yt-dlp is installed in the bin directory or in PATH (Linux)."
          )
        );
        return;
      }

      const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

      // Try to find FFmpeg path
      let ffmpegPath: string | null = null;
      try {
        ffmpegPath = await findFfmpegPath();
      } catch (error) {
        console.warn("Error finding FFmpeg path:", error);
        // Continue without FFmpeg path - yt-dlp will try to find it itself
      }

      const args = [
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--output",
        outputTemplate,
        "--no-playlist",
        "--write-thumbnail",
        "--write-info-json",
        "--force-overwrites",
        "--no-cache-dir",
      ];

      // Add FFmpeg location if found
      if (ffmpegPath) {
        args.push("--ffmpeg-location", ffmpegPath);
      }

      args.push(url);

      const child = spawn(ytDlpPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", async (code) => {
        if (code === 0) {
          try {
            // РќР°Р№С‚Рё СЃРєР°С‡Р°РЅРЅС‹Р№ С„Р°Р№Р»
            const files = await fs.readdir(outputDir);
            const mp3Files = files.filter((file) => file.endsWith(".mp3"));

            if (mp3Files.length === 0) {
              reject(new Error("РќРµ РЅР°Р№РґРµРЅ СЃРєР°С‡Р°РЅРЅС‹Р№ MP3 С„Р°Р№Р»"));
              return;
            }

            const filename = mp3Files[mp3Files.length - 1];
            const filepath = path.join(outputDir, filename);
            const title = filename.replace(".mp3", "");

            const {
              uploadFileToStorage,
              STORAGE_BUCKETS,
              sanitizeFilenameForStorage,
            } = await import("./storage/supabaseStorage");
            const fileBuffer = await fs.readFile(filepath);
            const safeFilename = sanitizeFilenameForStorage(filename);
            const storagePath = `${trackId}/${safeFilename}`;
            const { path: uploadedPath } = await uploadFileToStorage(
              STORAGE_BUCKETS.downloads,
              storagePath,
              fileBuffer,
              { contentType: "audio/mpeg", upsert: true }
            );

            try {
              await fs.remove(filepath);
            } catch (e) {
              // ignore
            }
            try {
              const list = await fs.readdir(outputDir);
              for (const f of list) {
                if (f.endsWith(".webp") || f.endsWith(".json")) {
                  await fs.remove(path.join(outputDir, f));
                }
              }
            } catch (e) {
              // ignore
            }

            resolve({ filePath: storagePath, title });
          } catch (error) {
            reject(new Error(`РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РІ Storage: ${error}`));
          }
        } else {
          // Improve error message for FFmpeg-related errors
          let errorMessage = stderr || stdout || "Unknown error";

          if (
            errorMessage.includes("ffmpeg") ||
            errorMessage.includes("ffprobe")
          ) {
            errorMessage =
              `FFmpeg РЅРµ РЅР°Р№РґРµРЅ. yt-dlp С‚СЂРµР±СѓРµС‚ FFmpeg РґР»СЏ РєРѕРЅРІРµСЂС‚Р°С†РёРё Р°СѓРґРёРѕ. ` +
              `РЈСЃС‚Р°РЅРѕРІРёС‚Рµ FFmpeg Рё РґРѕР±Р°РІСЊС‚Рµ РµРіРѕ РІ PATH, РёР»Рё СѓРєР°Р¶РёС‚Рµ РїСѓС‚СЊ С‡РµСЂРµР· --ffmpeg-location. ` +
              `РћСЂРёРіРёРЅР°Р»СЊРЅР°СЏ РѕС€РёР±РєР°: ${errorMessage}`;
          }

          reject(
            new Error(`yt-dlp Р·Р°РІРµСЂС€РёР»СЃСЏ СЃ РєРѕРґРѕРј ${code}: ${errorMessage}`)
          );
        }
      });

      child.on("error", (error) => {
        reject(new Error(`РћС€РёР±РєР° Р·Р°РїСѓСЃРєР° yt-dlp: ${error.message}`));
      });
    } catch (error) {
      reject(
        new Error(
          `РћС€РёР±РєР° РїСЂРё РЅР°СЃС‚СЂРѕР№РєРµ yt-dlp: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    }
  });
}

/**
 * РћСЃРЅРѕРІРЅР°СЏ С„СѓРЅРєС†РёСЏ СЃРєР°С‡РёРІР°РЅРёСЏ С‚СЂРµРєР°
 */
export async function downloadTrack(
  url: string,
  source: "youtube" | "youtube-music"
): Promise<Track> {
  // Dynamic import to avoid issues during static generation
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const trackId = generateTrackId();

  let filePath = "";
  let apiTitle = "";
  let storagePath = "";

  if (source === "youtube") {
    try {
      // Dynamic import to avoid loading at module import time
      const { downloadTrackViaRapidAPI } = await import(
        "./download/youtubeDownloader"
      );
      const result = await downloadTrackViaRapidAPI(
        url,
        config.folders.downloads,
        trackId
      );
      filePath = result.filePath;
      apiTitle = result.title;
      storagePath = result.storagePath || result.filePath;
    } catch (error) {
      const { isServerlessEnvironment } = await import("./utils/environment");
      // РќР° Vercel/Netlify yt-dlp РЅРµРґРѕСЃС‚СѓРїРµРЅ вЂ” РЅРµ РїСЂРѕР±СѓРµРј, СЃСЂР°Р·Сѓ РґР°С‘Рј СЃСЃС‹Р»РєСѓ РЅР° RapidAPI
      if (isServerlessEnvironment()) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С‡РµСЂРµР· RapidAPI: ${rapidApiError}. ` +
          `РќР° Vercel/Netlify РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ RapidAPI вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ RAPIDAPI_KEY Рё RAPIDAPI_HOST РІ РїРµСЂРµРјРµРЅРЅС‹С… РѕРєСЂСѓР¶РµРЅРёСЏ.`
        );
      }
      console.log("RapidAPI failed, checking if yt-dlp is available...");
      const { findFfmpegPath } = await import("./utils/ffmpegFinder");
      const ffmpegPath = await findFfmpegPath();
      if (!ffmpegPath) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С‚СЂРµРє С‡РµСЂРµР· RapidAPI: ${rapidApiError}. ` +
          `yt-dlp С‚СЂРµР±СѓРµС‚ FFmpeg РґР»СЏ СЂР°Р±РѕС‚С‹, РЅРѕ FFmpeg РЅРµ РЅР°Р№РґРµРЅ. ` +
          `РЈСЃС‚Р°РЅРѕРІРёС‚Рµ FFmpeg РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ РЅР°СЃС‚СЂРѕР№РєРё RapidAPI.`
        );
      }
      const { getYtDlpPath } = await import("./utils/ytDlpFinder");
      const ytDlpPath = await getYtDlpPath();
      if (!ytDlpPath) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С‚СЂРµРє С‡РµСЂРµР· RapidAPI: ${rapidApiError}. ` +
          `yt-dlp РЅРµ РЅР°Р№РґРµРЅ. РЈСЃС‚Р°РЅРѕРІРёС‚Рµ yt-dlp РІ РїР°РїРєСѓ bin/ РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ РЅР°СЃС‚СЂРѕР№РєРё RapidAPI.`
        );
      }
      console.log("RapidAPI failed, trying yt-dlp...");
      try {
        const result = await downloadTrackViaYtDlp(url, config.folders.downloads, trackId);
        filePath = result.filePath;
        apiTitle = result.title;
        storagePath = result.filePath;
      } catch (ytDlpError) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        const ytDlpErrorMessage = ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
        throw new Error(
          `РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С‚СЂРµРє. RapidAPI РѕС€РёР±РєР°: ${rapidApiError}. ` +
          `yt-dlp РѕС€РёР±РєР°: ${ytDlpErrorMessage}. ` +
          `РџСЂРѕРІРµСЂСЊС‚Рµ РїСЂР°РІРёР»СЊРЅРѕСЃС‚СЊ URL Рё РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ С‚СЂРµРєР°.`
        );
      }
    }
  } else if (source === "youtube-music") {
    // РќР° Vercel/Netlify С‚РѕР»СЊРєРѕ RapidAPI; Р»РѕРєР°Р»СЊРЅРѕ вЂ” RapidAPI, РїСЂРё РѕС€РёР±РєРµ fallback РЅР° yt-dlp
    try {
      const { downloadTrackViaRapidAPI } = await import("./download/youtubeDownloader");
      const result = await downloadTrackViaRapidAPI(
        url,
        config.folders.downloads,
        trackId
      );
      filePath = result.filePath;
      apiTitle = result.title;
      storagePath = result.storagePath || result.filePath;
    } catch (error) {
      const { isServerlessEnvironment } = await import("./utils/environment");
      if (isServerlessEnvironment()) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С‡РµСЂРµР· RapidAPI: ${rapidApiError}. ` +
          `РќР° Vercel/Netlify РґР»СЏ YouTube Music РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ RapidAPI вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ RAPIDAPI_KEY Рё RAPIDAPI_HOST.`
        );
      }
      try {
        const result = await downloadTrackViaYtDlp(url, config.folders.downloads, trackId);
        filePath = result.filePath;
        apiTitle = result.title;
        storagePath = result.filePath;
      } catch (ytDlpError) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        const ytDlpErr = ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
        throw new Error(
          `РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С‚СЂРµРє. RapidAPI: ${rapidApiError}. yt-dlp: ${ytDlpErr}. ` +
          `РџСЂРѕРІРµСЂСЊС‚Рµ URL Рё РЅР°СЃС‚СЂРѕР№РєРё RapidAPI.`
        );
      }
    }
  } else {
    throw new Error(`Unknown source type: ${source}`);
  }

  // Dynamic import to avoid issues during static generation
  const path = await import("path");
  const filename = path.basename(filePath);
  
  // РСЃРїРѕР»СЊР·СѓРµРј storagePath РµСЃР»Рё РѕРЅ Р±С‹Р» СѓСЃС‚Р°РЅРѕРІР»РµРЅ, РёРЅР°С‡Рµ filePath
  const finalPath = storagePath || filePath;
  
  const track: Track = {
    id: trackId,
    filename,
    originalPath: finalPath, // РСЃРїРѕР»СЊР·СѓРµРј storagePath РµСЃР»Рё РґРѕСЃС‚СѓРїРµРЅ, РёРЅР°С‡Рµ Р»РѕРєР°Р»СЊРЅС‹Р№ РїСѓС‚СЊ
    metadata: {
      title: apiTitle || filename.replace(".mp3", ""),
      artist: "Unknown",
      album: "Unknown",
      genre: "Средний",
      rating: config.processing.defaultRating,
      year: config.processing.defaultYear,
      sourceUrl: url, // Save original URL for re-downloading in serverless
      sourceType: source, // Save source type for re-downloading
    },
    status: "downloaded",
  };

  await setTrack(trackId, track);
  return track;
}

/**
 * Upload local file to Storage as a downloaded track
 */
export async function uploadLocalTrack(
  fileBuffer: Buffer,
  originalFilename: string,
  contentType?: string
): Promise<Track> {
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const trackId = generateTrackId();

  const path = await import("path");
  const {
    uploadFileToStorage,
    STORAGE_BUCKETS,
    sanitizeFilenameForStorage,
  } = await import("./storage/supabaseStorage");

  const safeFilename = sanitizeFilenameForStorage(
    originalFilename || `${trackId}.mp3`
  );
  const storagePath = `${trackId}/${safeFilename}`;
  await uploadFileToStorage(
    STORAGE_BUCKETS.downloads,
    storagePath,
    fileBuffer,
    { contentType: contentType || "audio/mpeg", upsert: true }
  );

  const filename = path.basename(safeFilename);
  const title = filename.replace(/\.[^.]+$/, "");

  const track: Track = {
    id: trackId,
    filename,
    originalPath: storagePath,
    metadata: {
      title: title || "Unknown",
      artist: "Unknown",
      album: "Unknown",
      genre: "Средний",
      rating: config.processing.defaultRating,
      year: config.processing.defaultYear,
    },
    status: "downloaded",
  };

  await setTrack(trackId, track);
  return track;
}

/**
 * РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ С‚СЂРµРєРё
 * Safe for production - never throws errors
 */
export async function getAllTracks(): Promise<Track[]> {
  try {
    // Early return for build-time environment - before any operations
    if (typeof process !== "undefined" && process.env) {
      // Check for Next.js build phase (most reliable indicator)
      if (process.env.NEXT_PHASE === "phase-production-build") {
        return [];
      }
      
      // Additional safety check: if we're in production but don't have runtime indicators
      if (
        process.env.NODE_ENV === "production" &&
        !process.env.NETLIFY_URL &&
        !process.env.VERCEL_URL &&
        !process.env.VERCEL &&
        !process.env.AWS_LAMBDA_FUNCTION_NAME &&
        !process.env.NETLIFY_DEV
      ) {
        // Likely static generation, return empty array
        return [];
      }
    }
    
    return await getAllTracksFromStorage();
  } catch (error) {
    // Never throw - return empty array to prevent Server Component errors
    console.error("Error in getAllTracks:", error);
    return [];
  }
}

/**
 * РџРѕР»СѓС‡РёС‚СЊ С‚СЂРµРє РїРѕ id
 */
export async function getTrack(trackId: string): Promise<Track | undefined> {
  return getTrackFromStorage(trackId);
}

/**
 * РћС‚РєР»РѕРЅРёС‚СЊ С‚СЂРµРє: РїРµСЂРµРЅРѕСЃ С„Р°Р№Р»Р° РёР· downloads РІ rejected (Supabase Storage)
 */
export async function rejectTrack(trackId: string): Promise<void> {
  const {
    downloadFileFromStorage,
    uploadFileToStorage,
    deleteFileFromStorage,
    STORAGE_BUCKETS,
  } = await import("./storage/supabaseStorage");

  const track = await getTrackFromStorage(trackId);
  if (!track) throw new Error("Track not found");
  if (!track.originalPath) throw new Error("Track has no original file");

  const buffer = await downloadFileFromStorage(
    STORAGE_BUCKETS.downloads,
    track.originalPath
  );
  await uploadFileToStorage(
    STORAGE_BUCKETS.rejected,
    track.originalPath,
    buffer,
    { contentType: "audio/mpeg", upsert: true }
  );
  await deleteFileFromStorage(STORAGE_BUCKETS.downloads, track.originalPath);

  track.status = "rejected";
  await setTrack(trackId, track);
}

/**
 * РћР±СЂР°Р±РѕС‚Р°С‚СЊ С‚СЂРµРє (РѕР±СЂРµР·РєР°, РѕРїСЂРµРґРµР»РµРЅРёРµ BPM, Р·Р°РїРёСЃСЊ С‚РµРіРѕРІ)
 */
export async function processTrack(
  trackId: string,
  metadata?: TrackMetadata,
  trimSettings?: {
    startTime: number;
    endTime?: number;
    fadeIn: number;
    fadeOut: number;
    maxDuration?: number;
  }
): Promise<Track> {
  console.log("Starting processTrack for trackId:", trackId);

  // Dynamic import to avoid issues during static generation
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const track = await getTrackFromStorage(trackId);
  if (!track) throw new Error("Track not found");

  console.log("Track found:", track.filename, "status:", track.status);

  // Р•СЃР»Рё С‚СЂРµРє СѓР¶Рµ РѕР±СЂР°Р±РѕС‚Р°РЅ РёР»Рё Р·Р°РіСЂСѓР¶РµРЅ, СЂР°Р·СЂРµС€Р°РµРј РїРѕРІС‚РѕСЂРЅСѓСЋ РѕР±СЂР°Р±РѕС‚РєСѓ
  // РЅРѕ РµСЃР»Рё РµСЃС‚СЊ processedPath Рё СЃС‚Р°С‚СѓСЃ processed/trimmed/uploaded, РѕР±РЅРѕРІР»СЏРµРј С‚РѕР»СЊРєРѕ РјРµС‚Р°РґР°РЅРЅС‹Рµ РµСЃР»Рё РЅРµ РїРµСЂРµРґР°РЅС‹ trimSettings
  if (
    (track.status === "processed" || track.status === "trimmed" || track.status === "uploaded") &&
    track.processedPath &&
    !trimSettings
  ) {
    console.log("Track already processed, updating metadata only");
    if (metadata) {
      Object.assign(track.metadata, metadata);
      if (track.processedPath) {
        try {
          const path = await import("path");
          const fs = await import("fs-extra");
          const {
            downloadFileFromStorage,
            uploadFileToStorage,
            STORAGE_BUCKETS,
          } = await import("./storage/supabaseStorage");
          const { writeTrackTags } = await import("./audio/metadataWriter");
          const tempPath = path.join(config.folders.processed, `${trackId}_tags.mp3`);
          const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.processed, track.processedPath);
          await fs.writeFile(tempPath, fileBuffer);
          await writeTrackTags(tempPath, track.metadata);
          const updatedBuffer = await fs.readFile(tempPath);
          await uploadFileToStorage(STORAGE_BUCKETS.processed, track.processedPath, updatedBuffer, { contentType: "audio/mpeg", upsert: true });
          await fs.remove(tempPath);
        } catch (tagError) {
          console.error("Error writing track tags:", tagError);
        }
      }
      await setTrack(trackId, track);
    }
    return track;
  }

  const path = await import("path");
  const fs = await import("fs-extra");
  const {
    uploadFileToStorage,
    downloadFileFromStorage,
    STORAGE_BUCKETS,
    sanitizeFilenameForStorage,
  } = await import("./storage/supabaseStorage");

  let tempInputPath: string | null = null;
  const tempInputPathLoc = path.join(config.folders.downloads, `${trackId}_temp_input.mp3`);
  const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.downloads, track.originalPath);
  await fs.writeFile(tempInputPathLoc, fileBuffer);
  tempInputPath = tempInputPathLoc;
  const inputFilePath = tempInputPathLoc;
  
  // РћР±СЂРµР·РєР° СЃ РЅР°СЃС‚СЂРѕР№РєР°РјРё РёР»Рё РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
  // РЎРѕР·РґР°РµРј РІСЂРµРјРµРЅРЅС‹Р№ С„Р°Р№Р» РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё
  const tempProcessedPath = path.join(config.folders.processed, `${trackId}_${track.filename}`);
  console.log(
    "Processing audio file:",
    inputFilePath,
    "->",
    tempProcessedPath
  );

  // Use new audio processor that works in Netlify
  const { processAudioFile } = await import("./audio/audioProcessor");
  await processAudioFile(
    inputFilePath,
    tempProcessedPath,
    trimSettings,
    config.processing.maxDuration
  );
  
  const storagePath = `${trackId}/${sanitizeFilenameForStorage(track.filename)}`;
  const processedBuffer = await fs.readFile(tempProcessedPath);
  await uploadFileToStorage(
    STORAGE_BUCKETS.processed,
    storagePath,
    processedBuffer,
    { contentType: "audio/mpeg", upsert: true }
  );
  const finalProcessedPath = storagePath;
  console.log("Processed file uploaded to Storage:", storagePath);

  try {
    if (tempInputPath && (await fs.pathExists(tempInputPath))) {
      await fs.remove(tempInputPath);
    }
  } catch (e) {
    console.warn("Error removing temp input:", e);
  }

  // РћРїСЂРµРґРµР»РµРЅРёРµ BPM (gracefully handles serverless)
  console.log("Starting BPM detection...");
  const { detectBpmNetlify } = await import("./audio/bpmDetectorNetlify");
  const bpm = await detectBpmNetlify(tempProcessedPath);
  if (bpm) {
    console.log("BPM detected:", bpm);
    track.metadata.bpm = bpm;
    // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕРїСЂРµРґРµР»РёС‚СЊ С‚РёРї РїРѕ BPM
    if (bpm >= 130) track.metadata.genre = "Быстрый";
    else if (bpm >= 90) track.metadata.genre = "Средний";
    else track.metadata.genre = "Медленный";
  } else {
    console.log("No BPM detected");
  }

  // РћР±РЅРѕРІРёС‚СЊ РјРµС‚Р°РґР°РЅРЅС‹Рµ, РµСЃР»Рё РїРµСЂРµРґР°РЅС‹
  if (metadata) {
    console.log("Updating metadata with:", metadata);
    Object.assign(track.metadata, metadata);
  }

  // РЎРѕС…СЂР°РЅРёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ РѕР± РѕР±СЂРµР·РєРµ С‚РѕР»СЊРєРѕ РµСЃР»Рё РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ Р±С‹Р»Р° РїСЂРёРјРµРЅРµРЅР° РѕР±СЂРµР·РєР°
  if (trimSettings) {
    console.log("Saving trim information:", trimSettings);

    // РџСЂРѕРІРµСЂСЏРµРј, Р±С‹Р»Р° Р»Рё РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ РїСЂРёРјРµРЅРµРЅР° РѕР±СЂРµР·РєР°
    const hasRealTrimming =
      trimSettings.startTime > 0 ||
      trimSettings.endTime ||
      trimSettings.fadeIn > 0 ||
      trimSettings.fadeOut > 0 ||
      (trimSettings.maxDuration && trimSettings.maxDuration < 360);

    if (hasRealTrimming) {
      track.metadata.isTrimmed = true;
      track.metadata.trimSettings = trimSettings;
      console.log("Track marked as trimmed with real trimming applied");
    } else {
      console.log("No real trimming applied, keeping track as original");
    }
  }

  console.log("Writing track tags...");
  try {
    const { writeTrackTags } = await import("./audio/metadataWriter");
    await writeTrackTags(tempProcessedPath, track.metadata);
    const updatedBuffer = await fs.readFile(tempProcessedPath);
    await uploadFileToStorage(STORAGE_BUCKETS.processed, storagePath, updatedBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  } catch (tagError) {
    console.error("Error writing track tags:", tagError);
  }

  try {
    if (await fs.pathExists(tempProcessedPath)) {
      await fs.remove(tempProcessedPath);
    }
  } catch (e) {
    console.warn("Error removing temp processed file:", e);
  }

  track.processedPath = finalProcessedPath;
  track.status = "processed";

  await setTrack(trackId, track);

  console.log("Track processing completed successfully");
  return track;
}

/**
 * РћР±СЂРµР·Р°С‚СЊ С‚СЂРµРє Р±РµР· Р°РЅР°Р»РёР·Р° BPM
 */
export async function trimTrack(
  trackId: string,
  trimSettings: {
    startTime: number;
    endTime?: number;
    fadeIn: number;
    fadeOut: number;
    maxDuration?: number;
  }
): Promise<Track> {
  console.log("Starting trimTrack for trackId:", trackId);

  // Dynamic import to avoid issues during static generation
  const path = await import("path");
  const fs = await import("fs-extra");
  const {
    uploadFileToStorage,
    downloadFileFromStorage,
    STORAGE_BUCKETS,
    sanitizeFilenameForStorage,
  } = await import("./storage/supabaseStorage");

  // Dynamic import to avoid issues during static generation
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const track = await getTrackFromStorage(trackId);
  if (!track) throw new Error("Track not found");

  console.log("Track found:", track.filename, "status:", track.status);

  const tempInputPath = path.join(config.folders.downloads, `${trackId}_temp_trim_input.mp3`);
  const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.downloads, track.originalPath);
  await fs.writeFile(tempInputPath, fileBuffer);

  const tempProcessedPath = path.join(config.folders.processed, `${trackId}_trimmed_${track.filename}`);
  console.log("Trimming audio file:", tempInputPath, "->", tempProcessedPath);

  const { processAudioFile } = await import("./audio/audioProcessor");
  await processAudioFile(
    tempInputPath,
    tempProcessedPath,
    trimSettings,
    config.processing.maxDuration
  );

  const storagePath = `${trackId}/${sanitizeFilenameForStorage(track.filename)}`;
  const processedBuffer = await fs.readFile(tempProcessedPath);
  await uploadFileToStorage(
    STORAGE_BUCKETS.processed,
    storagePath,
    processedBuffer,
    { contentType: "audio/mpeg", upsert: true }
  );
  console.log("Trimmed file uploaded to Storage:", storagePath);

  try {
    if (await fs.pathExists(tempInputPath)) await fs.remove(tempInputPath);
    if (await fs.pathExists(tempProcessedPath)) await fs.remove(tempProcessedPath);
  } catch (e) {
    console.warn("Error removing temp files:", e);
  }

  // РЎРѕС…СЂР°РЅРёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ РѕР± РѕР±СЂРµР·РєРµ
  console.log("Saving trim information:", trimSettings);

  // РџСЂРѕРІРµСЂСЏРµРј, Р±С‹Р»Р° Р»Рё РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ РїСЂРёРјРµРЅРµРЅР° РѕР±СЂРµР·РєР°
  const hasRealTrimming =
    trimSettings.startTime > 0 ||
    trimSettings.endTime !== undefined ||
    trimSettings.fadeIn > 0 ||
    trimSettings.fadeOut > 0 ||
    (trimSettings.maxDuration !== undefined && trimSettings.maxDuration < 360);

  if (hasRealTrimming) {
    track.metadata.isTrimmed = true;
    track.metadata.trimSettings = trimSettings;
    console.log("Track marked as trimmed with real trimming applied");
  } else {
    console.log("No real trimming applied, keeping track as original");
  }

  track.processedPath = storagePath;
  track.status = "trimmed";
  await setTrack(trackId, track);

  console.log("Track trimming completed successfully");
  return track;
}

/**
 * Р—Р°РіСЂСѓР·РєР° РЅР° FTP
 */
export async function uploadToFtp(
  trackId: string,
  ftpConfig: FtpConfig
): Promise<void> {
  console.log("Starting FTP upload for track:", trackId);
  
  const track = await getTrackFromStorage(trackId);
  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }

  if (!track.processedPath) {
    throw new Error(
      `Track ${trackId} is not processed. Processed path is missing. Current status: ${track.status}`
    );
  }

  console.log("Track found:", track.filename);
  console.log("Processed path:", track.processedPath);
  console.log("FTP config:", {
    host: ftpConfig.host,
    port: ftpConfig.port,
    user: ftpConfig.user,
    remotePath: ftpConfig.remotePath || "(root)",
  });

  // Update status to uploading
  track.status = "uploading";
  await setTrack(trackId, track);

  try {
    // Dynamic import to avoid issues in serverless
    const { uploadToFtp: uploadFileToFtp } = await import("./upload/ftpUploader");
    await uploadFileToFtp(track.processedPath, ftpConfig, track.metadata, track.id);

    // Р”РѕР±Р°РІР»СЏРµРј РІ radio_tracks РґР»СЏ РїСЂРѕРІРµСЂРєРё В«РЅР° СЂР°РґРёРѕВ» (РѕС€РёР±РєСѓ РЅРµ РїСЂРѕР±СЂР°СЃС‹РІР°РµРј)
    try {
      const { addRadioTrack } = await import("@/lib/radio/radioTracks");
      const { generateSafeFilename, normalizeForMatch } = await import(
        "@/lib/utils/filenameUtils"
      );
      const rawName = generateSafeFilename(track.metadata);
      const normalizedName = normalizeForMatch(rawName);
      if (normalizedName) {
        await addRadioTrack({
          normalizedName,
          rawName,
          trackType: track.metadata.genre,
          year: track.metadata.year,
          source: "ftp_upload",
        });
      }
    } catch (radioErr) {
      console.warn("[uploadToFtp] addRadioTrack failed:", radioErr);
    }

    console.log("FTP upload completed successfully for track:", trackId);

    // Update status to uploaded
    track.status = "uploaded";
    await setTrack(trackId, track);

    console.log("Track status updated to 'uploaded'");
  } catch (error) {
    console.error("FTP upload failed for track:", trackId, error);
    
    // Update status to error
    track.status = "error";
    track.error = error instanceof Error ? error.message : String(error);
    await setTrack(trackId, track);

    throw error;
  }
}



