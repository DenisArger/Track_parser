"use server";

import {
  getAllTracks as getAllTracksFromLib,
  downloadTrack as downloadTrackFromLib,
  processTrack as processTrackFromLib,
  rejectTrack as rejectTrackFromLib,
  trimTrack as trimTrackFromLib,
  getTrack as getTrackFromLib,
  uploadToFtp as uploadToFtpFromLib,
} from "@/lib/processTracks";
import { getTrackStats, cleanupTrackStatuses } from "@/lib/trackUtils";
import { TrackStatus } from "@/types/track";
import {
  getTrack as getTrackFromStorage,
  setTrack,
  saveTracksToFile,
} from "@/lib/storage/trackStorage";
// Dynamic import to avoid issues in serverless
// import { writeTrackTags } from "@/lib/audio/metadataWriter";
import {
  Track,
  TrackMetadata,
  TrimSettings,
  FtpConfig,
  DownloadRequest,
  ProcessingRequest,
  UploadRequest,
} from "@/types/track";
// Dynamic imports to avoid issues during static generation
// import fs from "fs-extra";
// import path from "path";

/**
 * Автоматическое определение типа источника по URL
 */
function detectSourceFromUrl(
  url: string
): "youtube" | "youtube-music" | "yandex" {
  if (url.includes("music.youtube.com")) {
    return "youtube-music";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  } else if (
    url.includes("music.yandex.ru") ||
    url.includes("music.yandex.com")
  ) {
    return "yandex";
  } else {
    // По умолчанию считаем YouTube
    return "youtube";
  }
}

/**
 * Получить все треки
 * Safe for production - returns empty array on error instead of throwing
 * Ensures data is serializable for Server Components
 * Handles static generation and serverless environments
 */
export async function getAllTracks(): Promise<Track[]> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:61',message:'getAllTracks entry',data:{hasProcess:typeof process!=='undefined',hasEnv:typeof process!=='undefined'&&!!process.env},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  try {
    // Early return for build-time environment - before any imports or operations
    // Check if we're in a build-time environment
    // During static generation, return empty array immediately
    if (typeof process !== "undefined" && process.env) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:67',message:'getAllTracks env check',data:{nextPhase:process.env.NEXT_PHASE,nodeEnv:process.env.NODE_ENV,netlifyUrl:process.env.NETLIFY_URL,vercelUrl:process.env.VERCEL_URL,awsLambda:process.env.AWS_LAMBDA_FUNCTION_NAME,netlifyDev:process.env.NETLIFY_DEV},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Check for Next.js build phase (most reliable indicator)
      if (process.env.NEXT_PHASE === "phase-production-build") {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:69',message:'getAllTracks build phase return',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return [];
      }
      
      // Additional safety check: if we're in production but don't have runtime indicators
      // This helps catch cases where static generation is happening
      // BUT: In Netlify, NETLIFY=true is set, so we should check for that too
      const isNetlify = !!process.env.NETLIFY;
      const hasRuntimeIndicator = 
        process.env.NETLIFY_URL ||
        process.env.VERCEL_URL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NETLIFY_DEV ||
        isNetlify;
      
      if (
        process.env.NODE_ENV === "production" &&
        !hasRuntimeIndicator
      ) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:82',message:'getAllTracks static gen return',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.error("[DEBUG] getAllTracks: Static generation detected, returning empty array", {
          nodeEnv: process.env.NODE_ENV,
          netlify: process.env.NETLIFY,
          netlifyUrl: process.env.NETLIFY_URL,
          hasRuntimeIndicator
        });
        // Likely static generation, return empty array
        return [];
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:87',message:'getAllTracks before getAllTracksFromLib',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Try to get tracks - this will handle all error cases internally
    const tracks = await getAllTracksFromLib();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:88',message:'getAllTracks after getAllTracksFromLib',data:{tracksIsArray:Array.isArray(tracks),tracksLength:tracks?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Ensure all tracks are serializable (remove any non-serializable properties)
    // This is critical for Server Components - all data must be serializable
    if (!Array.isArray(tracks)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:91',message:'getAllTracks non-array warning',data:{tracksType:typeof tracks},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.warn("getAllTracksFromLib returned non-array, returning empty array");
      return [];
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:96',message:'getAllTracks before mapping',data:{tracksCount:tracks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const mappedTracks: Track[] = [];
    
    for (const track of tracks) {
      // Create a clean, serializable copy of the track
      // Ensure all values are primitives or plain objects
      try {
        const mappedTrack: Track = {
          id: String(track.id || ""),
          filename: String(track.filename || ""),
          originalPath: String(track.originalPath || ""),
          processedPath: track.processedPath ? String(track.processedPath) : undefined,
          metadata: {
            title: String(track.metadata?.title || ""),
            artist: String(track.metadata?.artist || ""),
            album: String(track.metadata?.album || ""),
            genre: (track.metadata?.genre || "Средний") as Track["metadata"]["genre"],
            rating: Number(track.metadata?.rating || 0),
            year: Number(track.metadata?.year || 0),
            duration: track.metadata?.duration ? Number(track.metadata.duration) : undefined,
            bpm: track.metadata?.bpm ? Number(track.metadata.bpm) : undefined,
            isTrimmed: Boolean(track.metadata?.isTrimmed),
            trimSettings: track.metadata?.trimSettings
              ? {
                  startTime: Number(track.metadata.trimSettings.startTime || 0),
                  endTime: track.metadata.trimSettings.endTime
                    ? Number(track.metadata.trimSettings.endTime)
                    : undefined,
                  fadeIn: Number(track.metadata.trimSettings.fadeIn || 0),
                  fadeOut: Number(track.metadata.trimSettings.fadeOut || 0),
                  maxDuration: track.metadata.trimSettings.maxDuration
                    ? Number(track.metadata.trimSettings.maxDuration)
                    : undefined,
                }
              : undefined,
            sourceUrl: track.metadata?.sourceUrl ? String(track.metadata.sourceUrl) : undefined,
            sourceType: track.metadata?.sourceType as "youtube" | "youtube-music" | "yandex" | undefined,
          },
          status: String(track.status || "downloaded") as Track["status"],
          downloadProgress: track.downloadProgress ? Number(track.downloadProgress) : undefined,
          processingProgress: track.processingProgress
            ? Number(track.processingProgress)
            : undefined,
          uploadProgress: track.uploadProgress ? Number(track.uploadProgress) : undefined,
          error: track.error ? String(track.error) : undefined,
        };
        mappedTracks.push(mappedTrack);
      } catch (mapError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:140',message:'getAllTracks track mapping error',data:{errorMessage:mapError instanceof Error?mapError.message:String(mapError),trackId:track?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        // If mapping fails for a single track, log and skip it
        console.error("Error mapping track:", mapError, track);
        // Continue to next track - don't add this one to the result
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:147',message:'getAllTracks success return',data:{mappedTracksCount:mappedTracks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return mappedTracks;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/actions/trackActions.ts:149',message:'getAllTracks catch error',data:{errorMessage:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Log error but don't throw in production to avoid Server Component errors
    // This is critical - Server Actions must not throw during render
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[DEBUG] getAllTracks: Error fetching tracks", {
      errorMessage,
      errorStack,
      nodeEnv: typeof process !== "undefined" && process.env ? process.env.NODE_ENV : "unknown",
      netlify: typeof process !== "undefined" && process.env ? process.env.NETLIFY : "unknown",
      nextPhase: typeof process !== "undefined" && process.env ? process.env.NEXT_PHASE : "unknown"
    });
    // Return empty array instead of throwing to prevent Server Component render errors
    return [];
  }
}

/**
 * Скачать трек
 */
export async function downloadTrackAction(
  url: string,
  source?: "youtube" | "youtube-music" | "yandex"
): Promise<Track> {
  try {
    if (!url) {
      throw new Error("URL is required");
    }

    // Если source не указан, определяем автоматически
    const detectedSource = source || detectSourceFromUrl(url);

    return await downloadTrackFromLib(url, detectedSource);
  } catch (error) {
    // Улучшаем сообщение об ошибке для пользователя
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Специальная обработка ошибок Яндекс.Музыки
    if (
      errorMessage.includes("451") ||
      errorMessage.includes("Unavailable For Legal Reasons")
    ) {
      throw new Error(
        "Трек недоступен для скачивания. Возможные причины: геоблокировка, требуется авторизация или трек недоступен по юридическим причинам."
      );
    }

    // Специальная обработка ошибок yt-dlp
    if (errorMessage.includes("yt-dlp")) {
      throw new Error(
        `Ошибка скачивания: ${errorMessage}. Проверьте правильность URL и доступность трека.`
      );
    }

    throw new Error(`Ошибка скачивания: ${errorMessage}`);
  }
}

/**
 * Обработать трек
 */
export async function processTrackAction(
  trackId: string,
  metadata?: Partial<TrackMetadata>,
  trimSettings?: TrimSettings
): Promise<Track> {
  try {
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    return await processTrackFromLib(
      trackId,
      metadata as TrackMetadata | undefined,
      trimSettings
    );
  } catch (error) {
    throw new Error(
      `Processing failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Отклонить трек
 */
export async function rejectTrackAction(trackId: string): Promise<void> {
  try {
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    await rejectTrackFromLib(trackId);
  } catch (error) {
    throw new Error(
      `Failed to reject track: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Обрезать трек
 */
export async function trimTrackAction(
  trackId: string,
  trimSettings: TrimSettings
): Promise<Track> {
  try {
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    if (!trimSettings) {
      throw new Error("Trim settings are required");
    }

    return await trimTrackFromLib(trackId, trimSettings);
  } catch (error) {
    throw new Error(
      `Trim failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Создать preview обрезанного трека
 */
export async function createPreviewAction(
  trackId: string,
  trimSettings: TrimSettings
): Promise<{ previewId: string }> {
  try {
    // Dynamic imports to avoid issues during static generation
    const fs = await import("fs-extra");
    const path = await import("path");

    if (!trackId) {
      throw new Error("Track ID is required");
    }

    const track = await getTrackFromLib(trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    // Dynamic import to avoid issues in serverless
    const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");
    const workingDir = getSafeWorkingDirectory();

    // Проверяем существование файла
    if (!(await fs.pathExists(track.originalPath))) {
      // Попробуем найти файл в папке downloads
      const downloadsDir = path.join(workingDir, "downloads");
      try {
        const files = await fs.readdir(downloadsDir);
        const mp3Files = files.filter((file) => file.endsWith(".mp3"));

        if (mp3Files.length > 0) {
          track.originalPath = path.join(downloadsDir, mp3Files[0]);
        } else {
          throw new Error("Audio file not found");
        }
      } catch (error) {
        throw new Error("Audio file not found");
      }
    }

    // Создаем временный файл для предварительного прослушивания
    const tempDir = path.join(workingDir, "temp");
    await fs.ensureDir(tempDir);

    // Очищаем старые предварительные файлы (старше 1 часа)
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      for (const file of files) {
        if (file.startsWith("preview_") && file.endsWith(".mp3")) {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);
          if (now - stats.mtime.getTime() > 3600000) {
            // 1 час
            await fs.remove(filePath);
          }
        }
      }
    } catch (error) {
      console.log("Error cleaning old preview files:", error);
    }

    const previewId = `preview_${Date.now()}`;
    const previewPath = path.join(tempDir, `${previewId}.mp3`);

    // Use new audio processor that works in Netlify
    const { processAudioFile } = await import("@/lib/audio/audioProcessor");
    await processAudioFile(
      track.originalPath,
      previewPath,
      trimSettings,
      360 // 6 minutes default
    );

    return { previewId };
  } catch (error) {
    throw new Error(
      `Preview failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Обновить метаданные трека
 */
export async function updateMetadataAction(
  trackId: string,
  metadata: TrackMetadata
): Promise<Track> {
  try {
    if (!trackId || !metadata) {
      throw new Error("Track ID and metadata are required");
    }

    const track = await getTrackFromStorage(trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    // Update track metadata
    Object.assign(track.metadata, metadata);

    // Write metadata to audio file if processed path exists
    if (track.processedPath) {
      try {
        // Dynamic import to avoid issues in serverless
        const { writeTrackTags } = await import("@/lib/audio/metadataWriter");
        await writeTrackTags(track.processedPath, track.metadata);
        console.log("Metadata written to audio file:", track.processedPath);
      } catch (error) {
        console.error("Error writing metadata to audio file:", error);
        // Continue execution even if writing to audio file fails
      }
    }

    // Save track to storage and file
    setTrack(trackId, track);
    await saveTracksToFile();

    return track;
  } catch (error) {
    throw new Error(
      `Failed to update metadata: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Получить статистику треков
 */
export async function getTrackStatsAction(): Promise<{
  total: number;
  downloaded: number;
  processed: number;
  trimmed: number;
  rejected: number;
}> {
  try {
    return await getTrackStats();
  } catch (error) {
    throw new Error(
      `Failed to get stats: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Очистить статусы треков
 */
export async function cleanupTracksAction(): Promise<{
  statsBefore: {
    total: number;
    downloaded: number;
    processed: number;
    trimmed: number;
    rejected: number;
  };
  statsAfter: {
    total: number;
    downloaded: number;
    processed: number;
    trimmed: number;
    rejected: number;
  };
}> {
  try {
    // Получаем статистику до очистки
    const statsBefore = await getTrackStats();

    // Выполняем очистку
    await cleanupTrackStatuses();

    // Получаем статистику после очистки
    const statsAfter = await getTrackStats();

    return { statsBefore, statsAfter };
  } catch (error) {
    throw new Error(
      `Cleanup failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Загрузить трек на FTP
 */
export async function uploadTrackAction(
  trackId: string,
  ftpConfig: FtpConfig
): Promise<void> {
  try {
    if (!trackId || !ftpConfig) {
      throw new Error("Track ID and FTP config are required");
    }

    await uploadToFtpFromLib(trackId, ftpConfig);
  } catch (error) {
    throw new Error(
      `FTP upload failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Изменить статус трека
 */
export async function changeTrackStatusAction(
  trackId: string,
  newStatus: TrackStatus
): Promise<Track> {
  try {
    if (!trackId || !newStatus) {
      throw new Error("Track ID and new status are required");
    }

    const track = await getTrackFromStorage(trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    const oldStatus = track.status;
    track.status = newStatus;
    
    // Очищаем ошибку при изменении статуса
    if (track.error && newStatus !== "error") {
      delete track.error;
    }

    setTrack(trackId, track);
    await saveTracksToFile();

    console.log(`Track ${trackId} status changed from ${oldStatus} to ${newStatus}`);
    return track;
  } catch (error) {
    throw new Error(
      `Failed to change track status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Тестировать FTP соединение
 */
export async function testFtpConnectionAction(
  ftpConfig: FtpConfig
): Promise<void> {
  try {
    if (!ftpConfig.host || !ftpConfig.user) {
      throw new Error("Host and username are required");
    }

    const { Client: FtpClient } = await import("basic-ftp");
    const client = new FtpClient();

    try {
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.user,
        password: ftpConfig.password,
        secure: ftpConfig.secure,
      });
    } finally {
      client.close();
    }
  } catch (error) {
    throw new Error(
      `FTP connection failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
