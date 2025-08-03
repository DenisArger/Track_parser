import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import NodeID3 from "node-id3";
import MusicTempo from "music-tempo";
import axios from "axios";
import { Track, TrackMetadata, TrackType, FtpConfig } from "@/types/track";
import { loadConfig, AppConfig } from "./config";

// Global track storage
export const tracks = new Map<string, Track>();
const TRACKS_FILE = "tracks.json";

// Загрузка треков из файла при инициализации
async function loadTracksFromFile() {
  try {
    if (await fs.pathExists(TRACKS_FILE)) {
      const tracksData = await fs.readJson(TRACKS_FILE);
      tracks.clear();
      tracksData.forEach((track: Track) => {
        tracks.set(track.id, track);
      });
    }
  } catch (error) {
    console.error("Error loading tracks from file:", error);
  }
}

// Сохранение треков в файл
export async function saveTracksToFile() {
  try {
    const tracksArray = Array.from(tracks.values());
    await fs.writeJson(TRACKS_FILE, tracksArray, { spaces: 2 });
  } catch (error) {
    console.error("Error saving tracks to file:", error);
  }
}

// Инициализация при загрузке модуля
loadTracksFromFile();

function generateTrackId() {
  return Math.random().toString(36).slice(2, 10) + Date.now();
}

// Извлечение ID видео из URL YouTube и YouTube Music
function extractVideoId(url: string): string {
  const regex =
    /(?:youtube\.com\/watch\?v=|music\.youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  if (!match) throw new Error("Invalid YouTube URL");
  return match[1];
}

// Автоматическое определение типа источника по URL
function detectSourceFromUrl(
  url: string
): "youtube" | "youtube-music" | "yandex" {
  if (url.includes("music.youtube.com")) {
    return "youtube-music";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  } else if (url.includes("music.yandex.ru")) {
    return "yandex";
  } else {
    // По умолчанию считаем YouTube
    return "youtube";
  }
}

// Скачивание трека через RapidAPI
export async function downloadTrackViaRapidAPI(
  url: string,
  outputDir: string
): Promise<{ filePath: string; title: string }> {
  const config = await loadConfig();
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
    throw new Error("Не получена ссылка для скачивания от RapidAPI");
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
    .replace(/[^\w\s-а-яё]/gi, "") // Разрешаем кириллические символы
    .replace(/\s+/g, "_") // Заменяем пробелы на подчеркивания
    .substring(0, 100);
  const filename = `${safeTitle}.mp3`;
  const filepath = path.join(outputDir, filename);

  // Сохраняем файл
  await fs.writeFile(filepath, audioResponse.data);

  return { filePath: filepath, title: response.data.title };
}

// Скачивание трека через yt-dlp (более надежно для YouTube Music)
export async function downloadTrackViaYtDlp(
  url: string,
  outputDir: string
): Promise<{ filePath: string; title: string }> {
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

          resolve({ filePath: filepath, title });
        } catch (error) {
          reject(new Error(`Ошибка при поиске скачанного файла: ${error}`));
        }
      } else {
        reject(new Error(`yt-dlp завершился с кодом ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Ошибка запуска yt-dlp: ${error.message}`));
    });
  });
}

// Основная функция скачивания трека
export async function downloadTrack(
  url: string,
  source: "youtube" | "youtube-music" | "yandex"
): Promise<Track> {
  const config = await loadConfig();
  const trackId = generateTrackId();

  let filePath = "";
  let apiTitle = "";

  if (source === "youtube") {
    try {
      const result = await downloadTrackViaRapidAPI(
        url,
        config.folders.downloads
      );
      filePath = result.filePath;
      apiTitle = result.title;
    } catch (error) {
      // Если RapidAPI не сработал, пробуем yt-dlp
      console.log("RapidAPI failed, trying yt-dlp...");
      const result = await downloadTrackViaYtDlp(url, config.folders.downloads);
      filePath = result.filePath;
      apiTitle = result.title;
    }
  } else if (source === "youtube-music") {
    // Для YouTube Music используем yt-dlp напрямую
    const result = await downloadTrackViaYtDlp(url, config.folders.downloads);
    filePath = result.filePath;
    apiTitle = result.title;
  } else {
    // Здесь должна быть реализация для Яндекс Музыки
    throw new Error("Yandex Music download not implemented");
  }

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
    },
    status: "downloaded",
  };
  tracks.set(trackId, track);
  await saveTracksToFile(); // Сохраняем в файл
  return track;
}

// Функция для записи тегов в mp3-файл
export async function writeTrackTags(
  filePath: string,
  metadata: TrackMetadata
) {
  const tags = {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    genre: metadata.genre,
    year: metadata.year?.toString(),
    comment: {
      language: "eng",
      text: `Рейтинг: ${metadata.rating}`,
    },
  };
  return NodeID3.write(tags, filePath);
}

// Функция для определения BPM через music-tempo
export async function detectBpm(filePath: string): Promise<number | null> {
  const wavPath = filePath.replace(/\.[^.]+$/, ".bpm.wav");
  // 1. Сконвертировать в wav (моно, 44.1kHz)
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = require("fluent-ffmpeg");
    ffmpeg(filePath)
      .audioChannels(1)
      .audioFrequency(44100)
      .format("wav")
      .output(wavPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
  // 2. Прочитать wav-файл и получить PCM-данные
  const wav = await fs.readFile(wavPath);
  // WAV PCM начинается с 44 байта заголовка
  const pcm = new Int16Array(
    wav.buffer,
    wav.byteOffset + 44,
    (wav.length - 44) / 2
  );
  // 3. Преобразовать в массив чисел [-1, 1]
  const audioData = Array.from(pcm).map((x) => x / 32768);
  // 4. Определить BPM
  const mt = new MusicTempo(audioData);
  // 5. Удалить временный wav
  await fs.remove(wavPath);
  return mt.tempo || null;
}

// Получить все треки
export async function getAllTracks(): Promise<Track[]> {
  // Перезагружаем треки из файла на каждый запрос
  await loadTracksFromFile();
  const tracksArray = Array.from(tracks.values());
  return tracksArray;
}

// Получить трек по id
export async function getTrack(trackId: string): Promise<Track | undefined> {
  await loadTracksFromFile(); // Перезагружаем треки из файла
  return tracks.get(trackId);
}

// Отклонить трек
export async function rejectTrack(trackId: string): Promise<void> {
  const config = await loadConfig();
  const track = tracks.get(trackId);
  if (!track) throw new Error("Track not found");
  const rejectedPath = path.join(config.folders.rejected, track.filename);
  await fs.move(track.originalPath, rejectedPath, { overwrite: true });
  track.status = "rejected";
  tracks.set(trackId, track);
  await saveTracksToFile(); // Сохраняем изменения в файл
}

// Обработать трек (обрезка, определение BPM, запись тегов)
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

  const config = await loadConfig();
  const track = tracks.get(trackId);
  if (!track) throw new Error("Track not found");

  console.log("Track found:", track.filename, "status:", track.status);

  // Проверяем, что трек еще не обработан
  if (track.status === "processed") {
    console.log("Track already processed, updating metadata only");
    if (metadata) {
      Object.assign(track.metadata, metadata);
      await writeTrackTags(track.processedPath!, track.metadata);
      tracks.set(trackId, track);
      await saveTracksToFile();
    }
    return track;
  }

  // Обрезка с настройками или по умолчанию
  const processedPath = path.join(config.folders.processed, track.filename);
  console.log(
    "Processing audio file:",
    track.originalPath,
    "->",
    processedPath
  );

  const ffmpeg = require("fluent-ffmpeg");
  await new Promise<void>((resolve, reject) => {
    let command = ffmpeg(track.originalPath);

    // Применяем настройки обрезки
    if (trimSettings) {
      console.log("Using custom trim settings:", trimSettings);

      // Устанавливаем время начала
      command = command.setStartTime(trimSettings.startTime);

      // Устанавливаем длительность
      if (trimSettings.endTime) {
        const duration = trimSettings.endTime - trimSettings.startTime;
        command = command.duration(duration);
      } else if (trimSettings.maxDuration) {
        command = command.duration(trimSettings.maxDuration);
      } else {
        command = command.duration(config.processing.maxDuration);
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
            (trimSettings.maxDuration || config.processing.maxDuration) -
            trimSettings.fadeOut;
        command = command.audioFilters(
          `afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`
        );
      }
    } else {
      console.log("Using default trim settings");
      command = command.setStartTime(0).duration(config.processing.maxDuration);
    }

    command
      .output(processedPath)
      .on("end", () => {
        console.log("FFmpeg processing completed");
        resolve();
      })
      .on("error", (error: any) => {
        console.error("FFmpeg error:", error);
        reject(error);
      })
      .run();
  });

  // Определение BPM
  console.log("Starting BPM detection...");
  const bpm = await detectBpm(processedPath);
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
  await writeTrackTags(processedPath, track.metadata);

  track.processedPath = processedPath;
  track.status = "processed";
  tracks.set(trackId, track);
  await saveTracksToFile(); // Сохраняем изменения в файл

  console.log("Track processing completed successfully");
  return track;
}

// Обрезать трек без анализа BPM
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

  const config = await loadConfig();
  const track = tracks.get(trackId);
  if (!track) throw new Error("Track not found");

  console.log("Track found:", track.filename, "status:", track.status);

  // Обрезка с настройками
  const processedPath = path.join(config.folders.processed, track.filename);
  console.log("Trimming audio file:", track.originalPath, "->", processedPath);

  const ffmpeg = require("fluent-ffmpeg");
  await new Promise<void>((resolve, reject) => {
    let command = ffmpeg(track.originalPath);

    console.log("Using trim settings:", trimSettings);

    // Устанавливаем время начала
    command = command.setStartTime(trimSettings.startTime);

    // Устанавливаем длительность
    if (trimSettings.endTime) {
      const duration = trimSettings.endTime - trimSettings.startTime;
      command = command.duration(duration);
    } else if (trimSettings.maxDuration) {
      command = command.duration(trimSettings.maxDuration);
    } else {
      command = command.duration(config.processing.maxDuration);
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
          (trimSettings.maxDuration || config.processing.maxDuration) -
          trimSettings.fadeOut;
      command = command.audioFilters(
        `afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`
      );
    }

    command
      .output(processedPath)
      .on("end", () => {
        console.log("FFmpeg trimming completed");
        resolve();
      })
      .on("error", (error: any) => {
        console.error("FFmpeg error:", error);
        reject(error);
      })
      .run();
  });

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
  tracks.set(trackId, track);
  await saveTracksToFile();

  console.log("Track trimming completed successfully");
  return track;
}

// Загрузка на FTP
export async function uploadToFtp(
  trackId: string,
  ftpConfig: FtpConfig
): Promise<void> {
  const track = tracks.get(trackId);
  if (!track || !track.processedPath)
    throw new Error("Track not found or not processed");
  const { Client } = require("basic-ftp");
  const client = new Client();
  try {
    await client.access(ftpConfig);
    await client.uploadFrom(
      track.processedPath,
      path.basename(track.processedPath)
    );
    track.status = "uploaded";
    tracks.set(trackId, track);
  } finally {
    client.close();
  }
}
