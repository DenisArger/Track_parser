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
            reject(new Error(`Ошибка при загрузке в Storage: ${error}`));
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
      // На Vercel/Netlify yt-dlp недоступен — не пробуем, сразу даём ссылку на RapidAPI
      if (isServerlessEnvironment()) {
        const rapidApiError = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Не удалось скачать через RapidAPI: ${rapidApiError}. ` +
          `На Vercel/Netlify доступен только RapidAPI — проверьте RAPIDAPI_KEY и RAPIDAPI_HOST в переменных окружения.`
        );
      }
      console.log("RapidAPI failed, checking if yt-dlp is available...");
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
        const result = await downloadTrackViaYtDlp(url, config.folders.downloads, trackId);
        filePath = result.filePath;
        apiTitle = result.title;
        storagePath = result.filePath;
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
    // На Vercel/Netlify только RapidAPI; локально — RapidAPI, при ошибке fallback на yt-dlp
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
          `Не удалось скачать через RapidAPI: ${rapidApiError}. ` +
          `На Vercel/Netlify для YouTube Music доступен только RapidAPI — проверьте RAPIDAPI_KEY и RAPIDAPI_HOST.`
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
          `Не удалось скачать трек. RapidAPI: ${rapidApiError}. yt-dlp: ${ytDlpErr}. ` +
          `Проверьте URL и настройки RapidAPI.`
        );
      }
    }
  } else if (source === "yandex") {
    const { isServerlessEnvironment } = await import("./utils/environment");
    if (isServerlessEnvironment()) {
      throw new Error(
        "Яндекс.Музыка на Vercel/Netlify недоступна: требуется yt-dlp и локальная среда. Используйте YouTube или YouTube Music."
      );
    }
    try {
      const { downloadTrackViaYtDlp: downloadYandexTrackViaYtDlp } =
        await import("./download/yandexDownloader");
      const result = await downloadYandexTrackViaYtDlp(
        url,
        config.folders.downloads,
        trackId
      );
      filePath = result.filePath;
      apiTitle = result.title;
      storagePath = result.storagePath || result.filePath;
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
  
  // Используем storagePath если он был установлен, иначе filePath
  const finalPath = storagePath || filePath;
  
  const track: Track = {
    id: trackId,
    filename,
    originalPath: finalPath, // Используем storagePath если доступен, иначе локальный путь
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
 * Получить трек по id
 */
export async function getTrack(trackId: string): Promise<Track | undefined> {
  return getTrackFromStorage(trackId);
}

/**
 * Отклонить трек: перенос файла из downloads в rejected (Supabase Storage)
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
  
  // Обрезка с настройками или по умолчанию
  // Создаем временный файл для обработки
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

  // Определение BPM (gracefully handles serverless)
  console.log("Starting BPM detection...");
  const { detectBpmNetlify } = await import("./audio/bpmDetectorNetlify");
  const bpm = await detectBpmNetlify(tempProcessedPath);
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

  track.processedPath = storagePath;
  track.status = "trimmed";
  await setTrack(trackId, track);

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
  await setTrack(trackId, track);

  try {
    // Dynamic import to avoid issues in serverless
    const { uploadToFtp: uploadFileToFtp } = await import("./upload/ftpUploader");
    await uploadFileToFtp(track.processedPath, ftpConfig, track.metadata, track.id);
    
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
