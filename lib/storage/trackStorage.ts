import fs from "fs-extra";
import { Track } from "@/types/track";

const TRACKS_FILE = "tracks.json";
const tracks = new Map<string, Track>();

/**
 * Генерирует уникальный ID для трека
 */
export function generateTrackId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now();
}

/**
 * Загружает треки из файла
 */
export async function loadTracksFromFile(): Promise<void> {
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

/**
 * Сохраняет треки в файл
 */
export async function saveTracksToFile(): Promise<void> {
  try {
    const tracksArray = Array.from(tracks.values());
    await fs.writeJson(TRACKS_FILE, tracksArray, { spaces: 2 });
  } catch (error) {
    console.error("Error saving tracks to file:", error);
  }
}

/**
 * Получает все треки
 */
export async function getAllTracks(): Promise<Track[]> {
  await loadTracksFromFile();
  return Array.from(tracks.values());
}

/**
 * Получает трек по ID
 */
export async function getTrack(trackId: string): Promise<Track | undefined> {
  await loadTracksFromFile();
  return tracks.get(trackId);
}

/**
 * Сохраняет трек
 */
export function setTrack(trackId: string, track: Track): void {
  tracks.set(trackId, track);
}

/**
 * Получает трек из памяти (без загрузки из файла)
 */
export function getTrackFromMemory(trackId: string): Track | undefined {
  return tracks.get(trackId);
}

// Инициализация при загрузке модуля
loadTracksFromFile();
