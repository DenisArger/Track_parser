import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import NodeID3 from "node-id3";
import MusicTempo from "music-tempo";
import axios from "axios";
import { Track, TrackMetadata, TrackType, FtpConfig } from "@/types/track";
import { loadConfig } from "./config";

// Global track storage
const tracks = new Map<string, Track>();
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
async function saveTracksToFile() {
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

// Извлечение ID видео из URL YouTube
function extractVideoId(url: string): string {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  if (!match) throw new Error("Invalid YouTube URL");
  return match[1];
}

// Скачивание трека через RapidAPI
export async function downloadTrackViaRapidAPI(
  url: string,
  outputDir: string
): Promise<{ filePath: string; title: string }> {
  const config = await loadConfig();
  await fs.ensureDir(outputDir);
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

// Основная функция скачивания трека
export async function downloadTrack(
  url: string,
  source: "youtube" | "yandex"
): Promise<Track> {
  const config = await loadConfig();
  const trackId = generateTrackId();

  let filePath = "";
  let apiTitle = "";

  if (source === "youtube") {
    const result = await downloadTrackViaRapidAPI(
      url,
      config.folders.downloads
    );
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
}

// Обработать трек (обрезка, определение BPM, запись тегов)
export async function processTrack(
  trackId: string,
  metadata?: TrackMetadata
): Promise<Track> {
  const config = await loadConfig();
  const track = tracks.get(trackId);
  if (!track) throw new Error("Track not found");

  // Обрезка до maxDuration
  const processedPath = path.join(config.folders.processed, track.filename);
  const ffmpeg = require("fluent-ffmpeg");
  await new Promise<void>((resolve, reject) => {
    ffmpeg(track.originalPath)
      .setStartTime(0)
      .duration(config.processing.maxDuration)
      .output(processedPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });

  // Определение BPM
  const bpm = await detectBpm(processedPath);
  if (bpm) {
    track.metadata.bpm = bpm;
    // Автоматически определить тип по BPM
    if (bpm >= 130) track.metadata.genre = "Быстрый";
    else if (bpm >= 90) track.metadata.genre = "Средний";
    else track.metadata.genre = "Медленный";
  }

  // Обновить метаданные, если переданы
  if (metadata) {
    Object.assign(track.metadata, metadata);
  }

  // Записать теги
  await writeTrackTags(processedPath, track.metadata);

  track.processedPath = processedPath;
  track.status = "processed";
  tracks.set(trackId, track);
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
