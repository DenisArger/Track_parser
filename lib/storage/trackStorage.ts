import fs from "fs-extra";
import path from "path";
import { Track } from "@/types/track";

// Use absolute path to avoid issues in production
const TRACKS_FILE = path.join(process.cwd(), "tracks.json");
const tracks = new Map<string, Track>();

// Flag to track if tracks have been loaded from file
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

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
    isInitialized = true;
  } catch (error) {
    console.error("Error loading tracks from file:", error);
    // Continue with empty storage if file doesn't exist or can't be read
    isInitialized = true;
  }
}

/**
 * Ensures tracks are loaded from file (lazy initialization)
 * Safe for production - never throws errors
 */
async function ensureInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = loadTracksFromFile().catch((error) => {
      // Ensure we mark as initialized even if loading fails
      console.error("Failed to initialize tracks storage:", error);
      isInitialized = true;
      // Return void to satisfy Promise<void>
      return;
    });
  }

  try {
    await initializationPromise;
  } catch (error) {
    // This should not happen due to catch above, but just in case
    console.error("Error in ensureInitialized:", error);
    isInitialized = true;
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
  await ensureInitialized();
  return Array.from(tracks.values());
}

/**
 * Получает трек по ID
 */
export async function getTrack(trackId: string): Promise<Track | undefined> {
  await ensureInitialized();
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
