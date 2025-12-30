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
 * Скачивает трек через RapidAPI
 */
export async function downloadTrackViaRapidAPI(
  url: string,
  outputDir: string
): Promise<{ filePath: string; title: string }> {
  // Dynamic imports to avoid issues in serverless
  const fs = await import("fs-extra");
  const path = await import("path");
  const { loadConfig } = await import("@/lib/config");
  const { isServerlessEnvironment } = await import("@/lib/utils/environment");
  
  const config = await loadConfig();
  
  // Ensure directory exists - in serverless this should be /tmp
  try {
    await fs.ensureDir(outputDir);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[DEBUG] downloadTrackViaRapidAPI: Error creating directory", {
      outputDir,
      errorMessage,
      isServerless: isServerlessEnvironment()
    });
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

  // Создаем безопасное имя файла
  const safeTitle = response.data.title
    .replace(/[^\w\s-]/g, "")
    .substring(0, 100);
  const filename = `${safeTitle}.mp3`;
  const filepath = path.join(outputDir, filename);

  // Сохраняем файл
  await fs.writeFile(filepath, audioResponse.data);

  return { filePath: filepath, title: response.data.title };
}
