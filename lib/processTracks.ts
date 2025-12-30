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
  saveTracksToFile,
} from "./storage/trackStorage";
// Dynamic imports for modules that use spawn/exec to avoid issues in serverless
// These modules are only imported when needed, not at module load time
// import { detectBpm } from "./audio/bpmDetector"; // Moved to dynamic import
// import { writeTrackTags } from "./audio/metadataWriter"; // Moved to dynamic import
// import { uploadToFtp as uploadFileToFtp } from "./upload/ftpUploader"; // Moved to dynamic import
// Dynamic import to avoid issues during static generation
// import { isServerlessEnvironment } from "./utils/environment";

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
 * Скачивание трека через yt-dlp (более надежно для YouTube Music)
 */
export async function downloadTrackViaYtDlp(
  url: string,
  outputDir: string
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

  // Очищаем старые файлы перед скачиванием нового
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
            // Найти скачанный файл
            const files = await fs.readdir(outputDir);
            const mp3Files = files.filter((file) => file.endsWith(".mp3"));

            if (mp3Files.length === 0) {
              reject(new Error("Не найден скачанный MP3 файл"));
              return;
            }

            // Используем последний созданный файл
            const filename = mp3Files[mp3Files.length - 1];
            const filepath = path.join(outputDir, filename);

            // Извлекаем название из имени файла (убираем .mp3 и восстанавливаем оригинальные символы)
            const title = filename.replace(".mp3", "");

            console.log("Found downloaded file:", filename);
            console.log("File path:", filepath);
            console.log("Extracted title:", title);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'processTracks.ts:171',message:'File downloaded and path set',data:{filename,filepath,filenameLength:filename.length,hasSpaces:filename.includes(' '),hasLeadingSpaces:filename.startsWith(' '),hasTrailingSpaces:filename.endsWith(' '),outputDir},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion

            resolve({ filePath: filepath, title });
          } catch (error) {
            reject(new Error(`Ошибка при поиске скачанного файла: ${error}`));
          }
        } else {
          // Improve error message for FFmpeg-related errors
          let errorMessage = stderr || stdout || "Unknown error";

          if (
            errorMessage.includes("ffmpeg") ||
            errorMessage.includes("ffprobe")
          ) {
            errorMessage =
              `FFmpeg не найден. yt-dlp требует FFmpeg для конвертации аудио. ` +
              `Установите FFmpeg и добавьте его в PATH, или укажите путь через --ffmpeg-location. ` +
              `Оригинальная ошибка: ${errorMessage}`;
          }

          reject(
            new Error(`yt-dlp завершился с кодом ${code}: ${errorMessage}`)
          );
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Ошибка запуска yt-dlp: ${error.message}`));
      });
    } catch (error) {
      reject(
        new Error(
          `Ошибка при настройке yt-dlp: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    }
  });
}

/**
 * Основная функция скачивания трека
 */
export async function downloadTrack(
  url: string,
  source: "youtube" | "youtube-music" | "yandex"
): Promise<Track> {
  // Dynamic import to avoid issues during static generation
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const trackId = generateTrackId();

  let filePath = "";
  let apiTitle = "";

  if (source === "youtube") {
    try {
      // Dynamic import to avoid loading at module import time
      const { downloadTrackViaRapidAPI } = await import(
        "./download/youtubeDownloader"
      );
      const result = await downloadTrackViaRapidAPI(
        url,
        config.folders.downloads
      );
      filePath = result.filePath;
      apiTitle = result.title;
    } catch (error) {
      // Если RapidAPI не сработал, пробуем yt-dlp только если FFmpeg доступен
      console.log("RapidAPI failed, checking if yt-dlp is available...");
      
      // Проверяем наличие FFmpeg перед использованием yt-dlp
      const { findFfmpegPath } = await import("./utils/ffmpegFinder");
      const ffmpegPath = await findFfmpegPath();
      
      if (!ffmpegPath) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Не удалось скачать трек через RapidAPI: ${rapidApiError}. ` +
          `yt-dlp требует FFmpeg для работы, но FFmpeg не найден. ` +
          `Установите FFmpeg или проверьте настройки RapidAPI.`
        );
      }
      
      // Проверяем наличие yt-dlp
      const { getYtDlpPath } = await import("./utils/ytDlpFinder");
      const ytDlpPath = await getYtDlpPath();
      
      if (!ytDlpPath) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Не удалось скачать трек через RapidAPI: ${rapidApiError}. ` +
          `yt-dlp не найден. Установите yt-dlp в папку bin/ или проверьте настройки RapidAPI.`
        );
      }
      
      console.log("RapidAPI failed, trying yt-dlp...");
      try {
        const result = await downloadTrackViaYtDlp(url, config.folders.downloads);
        filePath = result.filePath;
        apiTitle = result.title;
      } catch (ytDlpError) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        const ytDlpErrorMessage = ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
        throw new Error(
          `Не удалось скачать трек. RapidAPI ошибка: ${rapidApiError}. ` +
          `yt-dlp ошибка: ${ytDlpErrorMessage}. ` +
          `Проверьте правильность URL и доступность трека.`
        );
      }
    }
  } else if (source === "youtube-music") {
    // Для YouTube Music используем yt-dlp напрямую
    const result = await downloadTrackViaYtDlp(url, config.folders.downloads);
    filePath = result.filePath;
    apiTitle = result.title;
  } else if (source === "yandex") {
    // Для Яндекс.Музыки используем yt-dlp
    try {
      // Dynamic import to avoid loading at module import time
      const { downloadTrackViaYtDlp: downloadYandexTrackViaYtDlp } =
        await import("./download/yandexDownloader");
      const result = await downloadYandexTrackViaYtDlp(
        url,
        config.folders.downloads
      );
      filePath = result.filePath;
      apiTitle = result.title;
    } catch (error) {
      throw new Error(
        `Ошибка скачивания с Яндекс.Музыки: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } else {
    throw new Error(`Unknown source type: ${source}`);
  }

  // Dynamic import to avoid issues during static generation
  const path = await import("path");
  const filename = path.basename(filePath);
  
  const track: Track = {
    id: trackId,
    filename,
    originalPath: filePath,
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

  setTrack(trackId, track);
  await saveTracksToFile();
  return track;
}

/**
 * Получить все треки
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
 * Получить трек по id
 */
export async function getTrack(trackId: string): Promise<Track | undefined> {
  return getTrackFromStorage(trackId);
}

/**
 * Отклонить трек
 */
export async function rejectTrack(trackId: string): Promise<void> {
  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");
  
  // Dynamic import to avoid issues during static generation
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const track = await getTrackFromStorage(trackId);
  if (!track) throw new Error("Track not found");

  const rejectedPath = path.join(config.folders.rejected, track.filename);
  await fs.move(track.originalPath, rejectedPath, { overwrite: true });
  track.status = "rejected";
  track.originalPath = rejectedPath;

  setTrack(trackId, track);
  await saveTracksToFile();
}

/**
 * Обработать трек (обрезка, определение BPM, запись тегов)
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

  // Если трек уже обработан или загружен, разрешаем повторную обработку
  // но если есть processedPath и статус processed/trimmed/uploaded, обновляем только метаданные если не переданы trimSettings
  if (
    (track.status === "processed" || track.status === "trimmed" || track.status === "uploaded") &&
    track.processedPath &&
    !trimSettings
  ) {
    console.log("Track already processed, updating metadata only");
    if (metadata) {
      Object.assign(track.metadata, metadata);
      // Dynamic import to avoid issues in serverless
      const { writeTrackTags } = await import("./audio/metadataWriter");
      await writeTrackTags(track.processedPath, track.metadata);
      setTrack(trackId, track);
      await saveTracksToFile();
    }
    return track;
  }

  // Dynamic import to avoid issues during static generation
  const path = await import("path");
  
  // Обрезка с настройками или по умолчанию
  const processedPath = path.join(config.folders.processed, track.filename);
  console.log(
    "Processing audio file:",
    track.originalPath,
    "->",
    processedPath
  );

  // Use new audio processor that works in Netlify
  const { processAudioFile } = await import("./audio/audioProcessor");
  await processAudioFile(
    track.originalPath,
    processedPath,
    trimSettings,
    config.processing.maxDuration
  );

  // Определение BPM (gracefully handles serverless)
  console.log("Starting BPM detection...");
  const { detectBpmNetlify } = await import("./audio/bpmDetectorNetlify");
  const bpm = await detectBpmNetlify(processedPath);
  if (bpm) {
    console.log("BPM detected:", bpm);
    track.metadata.bpm = bpm;
    // Автоматически определить тип по BPM
    if (bpm >= 130) track.metadata.genre = "Быстрый";
    else if (bpm >= 90) track.metadata.genre = "Средний";
    else track.metadata.genre = "Медленный";
  } else {
    console.log("No BPM detected");
  }

  // Обновить метаданные, если переданы
  if (metadata) {
    console.log("Updating metadata with:", metadata);
    Object.assign(track.metadata, metadata);
  }

  // Сохранить информацию об обрезке только если действительно была применена обрезка
  if (trimSettings) {
    console.log("Saving trim information:", trimSettings);

    // Проверяем, была ли действительно применена обрезка
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

  // Записать теги
  console.log("Writing track tags...");
  // Dynamic import to avoid issues in serverless
  const { writeTrackTags } = await import("./audio/metadataWriter");
  await writeTrackTags(processedPath, track.metadata);

  track.processedPath = processedPath;
  track.status = "processed";

  setTrack(trackId, track);
  await saveTracksToFile();

  console.log("Track processing completed successfully");
  return track;
}

/**
 * Обрезать трек без анализа BPM
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

  // Dynamic import to avoid issues during static generation
  const { loadConfig } = await import("./config");
  const config = await loadConfig();
  const track = await getTrackFromStorage(trackId);
  if (!track) throw new Error("Track not found");

  console.log("Track found:", track.filename, "status:", track.status);

  // Обрезка с настройками
  const processedPath = path.join(config.folders.processed, track.filename);
  console.log("Trimming audio file:", track.originalPath, "->", processedPath);

  // Use new audio processor that works in Netlify
  const { processAudioFile } = await import("./audio/audioProcessor");
  await processAudioFile(
    track.originalPath,
    processedPath,
    trimSettings,
    config.processing.maxDuration
  );

  // Сохранить информацию об обрезке
  console.log("Saving trim information:", trimSettings);

  // Проверяем, была ли действительно применена обрезка
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

  track.processedPath = processedPath;
  track.status = "trimmed";
  setTrack(trackId, track);
  await saveTracksToFile();

  console.log("Track trimming completed successfully");
  return track;
}

/**
 * Загрузка на FTP
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
  setTrack(trackId, track);
  await saveTracksToFile();

  try {
    // Dynamic import to avoid issues in serverless
    const { uploadToFtp: uploadFileToFtp } = await import("./upload/ftpUploader");
    await uploadFileToFtp(track.processedPath, ftpConfig, track.metadata);
    
    console.log("FTP upload completed successfully for track:", trackId);
    
    // Update status to uploaded
    track.status = "uploaded";
    setTrack(trackId, track);
    await saveTracksToFile();
    
    console.log("Track status updated to 'uploaded'");
  } catch (error) {
    console.error("FTP upload failed for track:", trackId, error);
    
    // Update status to error
    track.status = "error";
    track.error = error instanceof Error ? error.message : String(error);
    setTrack(trackId, track);
    await saveTracksToFile();
    
    throw error;
  }
}
