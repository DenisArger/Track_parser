import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";

/**
 * Извлекает ID трека из URL Яндекс.Музыки
 * Поддерживает форматы:
 * - https://music.yandex.ru/album/{albumId}/track/{trackId}
 * - https://music.yandex.ru/track/{trackId}
 * - https://music.yandex.com/album/{albumId}/track/{trackId}
 * - https://music.yandex.com/track/{trackId}
 */
export function extractTrackId(url: string): string | null {
  // Паттерн для URL с album и track
  const albumTrackRegex =
    /music\.yandex\.(ru|com)\/album\/\d+\/track\/(\d+)/;
  const albumTrackMatch = url.match(albumTrackRegex);
  if (albumTrackMatch) {
    return albumTrackMatch[2];
  }

  // Паттерн для прямого URL трека
  const trackRegex = /music\.yandex\.(ru|com)\/track\/(\d+)/;
  const trackMatch = url.match(trackRegex);
  if (trackMatch) {
    return trackMatch[2];
  }

  return null;
}

/**
 * Проверяет, является ли URL валидным URL Яндекс.Музыки
 */
export function isValidYandexMusicUrl(url: string): boolean {
  return /music\.yandex\.(ru|com)/.test(url);
}

/**
 * Скачивание трека через yt-dlp для Яндекс.Музыки
 */
export async function downloadTrackViaYtDlp(
  url: string,
  outputDir: string
): Promise<{ filePath: string; title: string }> {
  await fs.ensureDir(outputDir);

  // Проверяем валидность URL
  if (!isValidYandexMusicUrl(url)) {
    throw new Error("Invalid Yandex Music URL");
  }

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

  return new Promise((resolve, reject) => {
    const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");
    const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

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
      url,
    ];

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
            reject(
              new Error(
                "Не найден скачанный MP3 файл. Возможно, yt-dlp не поддерживает этот URL Яндекс.Музыки или требуется авторизация."
              )
            );
            return;
          }

          // Используем последний созданный файл
          const filename = mp3Files[mp3Files.length - 1];
          const filepath = path.join(outputDir, filename);

          // Извлекаем название из имени файла (убираем .mp3)
          const title = filename.replace(".mp3", "");

          console.log("Found downloaded file:", filename);
          console.log("File path:", filepath);
          console.log("Extracted title:", title);

          resolve({ filePath: filepath, title });
        } catch (error) {
          reject(new Error(`Ошибка при поиске скачанного файла: ${error}`));
        }
      } else {
        // Более информативное сообщение об ошибке
        const errorMessage = stderr || stdout || "Unknown error";
        reject(
          new Error(
            `yt-dlp завершился с кодом ${code} для Яндекс.Музыки. Возможно, yt-dlp не поддерживает этот URL или требуется авторизация. Детали: ${errorMessage}`
          )
        );
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Ошибка запуска yt-dlp: ${error.message}`));
    });
  });
}

