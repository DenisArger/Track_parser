// Dynamic imports to avoid issues in serverless
// import fs from "fs-extra";
// import path from "path";
import axios from "axios";
// Dynamic import to avoid issues in serverless
// import { loadConfig } from "@/lib/config";

/**
 * Извлекает ID видео из URL YouTube
 */
export function extractVideoId(url: string): string {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  if (!match) throw new Error("Invalid YouTube URL");
  return match[1];
}

/**
 * Скачивает трек через RapidAPI и загружает в Supabase Storage
 */
export async function downloadTrackViaRapidAPI(
  url: string,
  outputDir: string,
  trackId?: string
): Promise<{ filePath: string; title: string; storagePath: string }> {
  // Dynamic imports to avoid issues in serverless
  const fs = await import("fs-extra");
  const path = await import("path");
  const { loadConfig } = await import("@/lib/config");
  const {
    uploadFileToStorage,
    STORAGE_BUCKETS,
    sanitizeFilenameForStorage,
  } = await import("@/lib/storage/supabaseStorage");

  const config = await loadConfig();

  // Ensure directory exists - in serverless this should be /tmp
  try {
    await fs.ensureDir(outputDir);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create output directory: ${errorMessage}`);
  }
  const videoId = extractVideoId(url);

  // Прямой запрос к youtube-mp36 API
  const options = {
    method: "GET",
    url: "https://youtube-mp36.p.rapidapi.com/dl",
    params: {
      id: videoId,
    },
    headers: {
      "x-rapidapi-key": config.rapidapi.key,
      "x-rapidapi-host": config.rapidapi.host,
    },
  };

  const response = await axios.request(options);

  if (response.data.status === "fail") {
    throw new Error(`RapidAPI error: ${response.data.msg || "Unknown error"}`);
  }

  if (!response.data.link) {
    throw new Error("No download link received from RapidAPI");
  }

  // Скачиваем аудиофайл
  const audioResponse = await axios.get(response.data.link, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://youtube-mp36.p.rapidapi.com/",
      Accept:
        "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  // Создаем безопасное имя файла для Storage (без кириллицы/пробелов — Invalid key)
  const rawTitle = (response.data.title || "audio").substring(0, 100);
  const filename = sanitizeFilenameForStorage(`${rawTitle}.mp3`);
  const filepath = path.join(outputDir, filename);

  // Сохраняем файл временно (для обработки или как fallback)
  await fs.writeFile(filepath, audioResponse.data);

  // Загружаем в Supabase Storage
  const storagePath = trackId ? `${trackId}/${filename}` : `${Date.now()}_${filename}`;
  const fileBuffer = Buffer.from(audioResponse.data);
  
  const { path: uploadedPath } = await uploadFileToStorage(
    STORAGE_BUCKETS.downloads,
    storagePath,
    fileBuffer,
    {
      contentType: "audio/mpeg",
      upsert: true,
    }
  );

  // Всегда удаляем локальный файл после успешной загрузки в Storage
  try {
    await fs.remove(filepath);
  } catch (e) {
    // Игнорируем ошибки удаления
  }

  return {
    filePath: uploadedPath,
    title: response.data.title,
    storagePath: uploadedPath,
  };
}
