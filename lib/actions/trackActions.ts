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
  deleteAllTracks,
} from "@/lib/storage/trackStorage";
import {
  Track,
  TrackMetadata,
  TrimSettings,
  FtpConfig,
  DownloadRequest,
  ProcessingRequest,
  UploadRequest,
} from "@/types/track";
import { requireAuth } from "@/lib/supabase/server";
import { detectSourceFromUrl } from "@/lib/utils/sourceDetection";

/**
 * Получить все треки
 * Safe for production - returns empty array on error instead of throwing
 * Ensures data is serializable for Server Components
 * Handles static generation and serverless environments
 */
export async function getAllTracks(): Promise<Track[]> {
  try {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.NEXT_PHASE === "phase-production-build") {
        return [];
      }
      const isNetlify = !!process.env.NETLIFY;
      const hasRuntimeIndicator =
        process.env.NETLIFY_URL ||
        process.env.VERCEL_URL ||
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NETLIFY_DEV ||
        isNetlify;
      if (process.env.NODE_ENV === "production" && !hasRuntimeIndicator) {
        console.warn("getAllTracks: static generation suspected, returning empty array");
        return [];
      }
    }

    await requireAuth();

    const tracks = await getAllTracksFromLib();

    if (!Array.isArray(tracks)) {
      console.warn("getAllTracksFromLib returned non-array, returning empty array");
      return [];
    }

    const mappedTracks: Track[] = [];

    for (const track of tracks) {
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
        console.error("Error mapping track:", mapError, track);
      }
    }

    return mappedTracks;
  } catch (error) {
    console.error("getAllTracks: Error fetching tracks", error);
    return [];
  }
}

export type DownloadTrackResult =
  | { ok: true; track: Track }
  | { ok: false; error: string };

/**
 * Скачать трек.
 * Возвращает { ok, track } или { ok: false, error } вместо throw,
 * чтобы в production не терять текст ошибки из‑за санитизации Next.js.
 */
export async function downloadTrackAction(
  url: string,
  source?: "youtube" | "youtube-music" | "yandex"
): Promise<DownloadTrackResult> {
  try {
    await requireAuth();
    if (!url) {
      return { ok: false, error: "URL is required" };
    }

    const detectedSource = source || detectSourceFromUrl(url);
    const track = await downloadTrackFromLib(url, detectedSource);
    return { ok: true, track };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[downloadTrackAction] Error:", errorMessage, (error as Error)?.stack);

    if (
      errorMessage.includes("451") ||
      errorMessage.includes("Unavailable For Legal Reasons")
    ) {
      return {
        ok: false,
        error:
          "Трек недоступен для скачивания. Возможные причины: геоблокировка, требуется авторизация или трек недоступен по юридическим причинам.",
      };
    }

    if (errorMessage.includes("yt-dlp")) {
      return {
        ok: false,
        error: `Ошибка скачивания: ${errorMessage}. Проверьте правильность URL и доступность трека.`,
      };
    }

    if (/Missing Supabase|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_SUPABASE/i.test(errorMessage)) {
      return {
        ok: false,
        error:
          "Не заданы переменные Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Проверьте Environment Variables на Vercel.",
      };
    }
    if (/RAPIDAPI|rapidapi/i.test(errorMessage) && /key|401|403|missing/i.test(errorMessage)) {
      return {
        ok: false,
        error:
          "Ошибка RapidAPI (YouTube): проверьте RAPIDAPI_KEY и RAPIDAPI_HOST в переменных окружения на Vercel.",
      };
    }

    return { ok: false, error: `Ошибка скачивания: ${errorMessage}` };
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
    await requireAuth();
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    return await processTrackFromLib(
      trackId,
      metadata as TrackMetadata | undefined,
      trimSettings
    );
  } catch (error) {
    console.error("[processTrackAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    await rejectTrackFromLib(trackId);
  } catch (error) {
    console.error("[rejectTrackAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    if (!trimSettings) {
      throw new Error("Trim settings are required");
    }

    return await trimTrackFromLib(trackId, trimSettings);
  } catch (error) {
    console.error("[trimTrackAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    const fs = await import("fs-extra");
    const path = await import("path");

    if (!trackId) {
      throw new Error("Track ID is required");
    }

    const track = await getTrackFromLib(trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");
    const tempDir = path.join(getSafeWorkingDirectory(), "temp");
    await fs.ensureDir(tempDir);

    const {
      downloadFileFromStorage,
      uploadFileToStorage,
      STORAGE_BUCKETS,
    } = await import("@/lib/storage/supabaseStorage");

    const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.downloads, track.originalPath);
    const tempInputPath = path.join(tempDir, `${trackId}_preview_input.mp3`);
    await fs.writeFile(tempInputPath, fileBuffer);

    const previewId = `preview_${Date.now()}`;
    const previewPath = path.join(tempDir, `${previewId}.mp3`);

    const { processAudioFile } = await import("@/lib/audio/audioProcessor");
    await processAudioFile(tempInputPath, previewPath, trimSettings, 360);

    const previewBuffer = await fs.readFile(previewPath);
    await uploadFileToStorage(
      STORAGE_BUCKETS.previews,
      `${previewId}.mp3`,
      previewBuffer,
      { contentType: "audio/mpeg", upsert: true }
    );

    try {
      await fs.remove(tempInputPath);
      await fs.remove(previewPath);
    } catch (e) {
      console.warn("Error removing temp preview files:", e);
    }

    return { previewId };
  } catch (error) {
    console.error("[createPreviewAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    if (!trackId || !metadata) {
      throw new Error("Track ID and metadata are required");
    }

    const track = await getTrackFromStorage(trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    // Update track metadata
    Object.assign(track.metadata, metadata);

    if (track.processedPath) {
      try {
        const fs = await import("fs-extra");
        const path = await import("path");
        const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");
        const {
          downloadFileFromStorage,
          uploadFileToStorage,
          STORAGE_BUCKETS,
        } = await import("@/lib/storage/supabaseStorage");
        const { writeTrackTags } = await import("@/lib/audio/metadataWriter");

        const tempPath = path.join(getSafeWorkingDirectory(), "temp", `${trackId}_metadata.mp3`);
        await fs.ensureDir(path.dirname(tempPath));
        const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.processed, track.processedPath);
        await fs.writeFile(tempPath, fileBuffer);
        await writeTrackTags(tempPath, track.metadata);
        const updatedBuffer = await fs.readFile(tempPath);
        await uploadFileToStorage(STORAGE_BUCKETS.processed, track.processedPath, updatedBuffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });
        await fs.remove(tempPath);
      } catch (error) {
        console.error("Error writing metadata to audio file:", error);
      }
    }

    await setTrack(trackId, track);

    return track;
  } catch (error) {
    console.error("[updateMetadataAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    return await getTrackStats();
  } catch (error) {
    console.error("[getTrackStatsAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    // Получаем статистику до очистки
    const statsBefore = await getTrackStats();

    // Выполняем очистку
    await cleanupTrackStatuses();

    // Получаем статистику после очистки
    const statsAfter = await getTrackStats();

    return { statsBefore, statsAfter };
  } catch (error) {
    console.error("[cleanupTracksAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
    if (!trackId || !ftpConfig) {
      throw new Error("Track ID and FTP config are required");
    }

    await uploadToFtpFromLib(trackId, ftpConfig);
  } catch (error) {
    console.error("[uploadTrackAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
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
    await requireAuth();
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

    await setTrack(trackId, track);

    console.log(`Track ${trackId} status changed from ${oldStatus} to ${newStatus}`);
    return track;
  } catch (error) {
    console.error("[changeTrackStatusAction] Error:", error instanceof Error ? error.message : String(error), (error as Error)?.stack);
    throw new Error(
      `Failed to change track status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Сбросить все данные: удалить все треки и очистить бакеты Storage.
 */
export async function resetAllDataAction(): Promise<{
  ok: boolean;
  deleted: number;
  cleared: Record<string, number>;
  error?: string;
}> {
  try {
    await requireAuth();
    const { deleted, cleared } = await deleteAllTracks();
    return { ok: true, deleted, cleared };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("resetAllDataAction:", error);
    return { ok: false, deleted: 0, cleared: {}, error: msg };
  }
}

/**
 * Тестировать FTP соединение.
 * Таймаут 15 с — при недоступности сервера быстрее получить ответ.
 */
export async function testFtpConnectionAction(
  ftpConfig: FtpConfig
): Promise<void> {
  try {
    await requireAuth();
    if (!ftpConfig.host || !ftpConfig.user) {
      throw new Error("Host and username are required");
    }

    const { Client: FtpClient } = await import("basic-ftp");
    const client = new FtpClient(15000);

    try {
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port ?? 21,
        user: ftpConfig.user,
        password: ftpConfig.password ?? "",
        secure: ftpConfig.secure,
      });
    } finally {
      client.close();
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[testFtpConnectionAction] Error:", errMsg, (error as Error)?.stack);
    const hint = /timeout|ETIMEDOUT|ECONNREFUSED/i.test(errMsg)
      ? " Проверьте хост, порт и доступность FTP. На Netlify исходящий FTP может блокироваться."
      : "";
    throw new Error(`FTP connection failed: ${errMsg}${hint}`);
  }
}
