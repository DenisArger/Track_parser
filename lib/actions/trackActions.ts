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
import {
  getTrack as getTrackFromStorage,
  setTrack,
  saveTracksToFile,
} from "@/lib/storage/trackStorage";
import { writeTrackTags } from "@/lib/audio/metadataWriter";
import {
  Track,
  TrackMetadata,
  TrimSettings,
  FtpConfig,
  DownloadRequest,
  ProcessingRequest,
  UploadRequest,
} from "@/types/track";
import fs from "fs-extra";
import path from "path";

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
 */
export async function getAllTracks(): Promise<Track[]> {
  try {
    return await getAllTracksFromLib();
  } catch (error) {
    throw new Error(
      `Failed to fetch tracks: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    const track = await getTrackFromLib(trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    // Проверяем существование файла
    if (!(await fs.pathExists(track.originalPath))) {
      // Попробуем найти файл в папке downloads
      const downloadsDir = path.join(process.cwd(), "downloads");
      const files = await fs.readdir(downloadsDir);
      const mp3Files = files.filter((file) => file.endsWith(".mp3"));

      if (mp3Files.length > 0) {
        track.originalPath = path.join(downloadsDir, mp3Files[0]);
      } else {
        throw new Error("Audio file not found");
      }
    }

    // Создаем временный файл для предварительного прослушивания
    const tempDir = path.join(process.cwd(), "temp");
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

    // Применяем настройки обрезки с помощью FFmpeg
    const ffmpegModule = await import("fluent-ffmpeg");
    const ffmpeg = ffmpegModule.default || ffmpegModule;
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg(track.originalPath);

      // Устанавливаем время начала
      command = command.setStartTime(trimSettings.startTime);

      // Устанавливаем длительность
      if (trimSettings.endTime) {
        const duration = trimSettings.endTime - trimSettings.startTime;
        command = command.duration(duration);
      } else if (trimSettings.maxDuration) {
        command = command.duration(trimSettings.maxDuration);
      } else {
        command = command.duration(360); // 6 минут по умолчанию
      }

      // Применяем затухание
      if (trimSettings.fadeIn > 0) {
        command = command.audioFilters(
          `afade=t=in:st=${trimSettings.startTime}:d=${trimSettings.fadeIn}`
        );
      }

      if (trimSettings.fadeOut > 0) {
        const fadeOutStart = trimSettings.endTime
          ? trimSettings.endTime - trimSettings.fadeOut
          : trimSettings.startTime +
            (trimSettings.maxDuration || 360) -
            trimSettings.fadeOut;
        command = command.audioFilters(
          `afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`
        );
      }

      command
        .output(previewPath)
        .on("end", () => {
          console.log("Preview file created successfully");
          resolve();
        })
        .on("error", (error: any) => {
          console.error("FFmpeg preview error:", error);
          reject(error);
        })
        .run();
    });

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
