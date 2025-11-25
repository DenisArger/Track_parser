import path from "path";
import { Track, TrackMetadata, FtpConfig } from "@/types/track";
import { loadConfig } from "./config";
import {
  generateTrackId,
  getAllTracks as getAllTracksFromStorage,
  getTrack as getTrackFromStorage,
  setTrack,
  saveTracksToFile,
} from "./storage/trackStorage";
import { downloadTrackViaRapidAPI } from "./download/youtubeDownloader";
import { detectBpm } from "./audio/bpmDetector";
import { writeTrackTags } from "./audio/metadataWriter";
import { uploadToFtp as uploadFileToFtp } from "./upload/ftpUploader";
import fs from "fs-extra";

/**
 * Основная функция скачивания трека
 */
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

  setTrack(trackId, track);
  await saveTracksToFile();
  return track;
}

/**
 * Получить все треки
 */
export async function getAllTracks(): Promise<Track[]> {
  return getAllTracksFromStorage();
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
  metadata?: TrackMetadata
): Promise<Track> {
  const config = await loadConfig();
  const track = await getTrackFromStorage(trackId);
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

  setTrack(trackId, track);
  await saveTracksToFile();
  return track;
}

/**
 * Загрузка на FTP
 */
export async function uploadToFtp(
  trackId: string,
  ftpConfig: FtpConfig
): Promise<void> {
  const track = await getTrackFromStorage(trackId);
  if (!track || !track.processedPath) {
    throw new Error("Track not found or not processed");
  }

  await uploadFileToFtp(track.processedPath, ftpConfig);

  track.status = "uploaded";
  setTrack(trackId, track);
  await saveTracksToFile();
}
