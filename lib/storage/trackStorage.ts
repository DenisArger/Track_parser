import fs from "fs-extra";
import path from "path";
import { Track } from "@/types/track";

// Lazy evaluation of tracks file path to avoid issues in production
// Compute path when needed, not at module import time
function getTracksFilePath(): string {
  try {
    return path.join(process.cwd(), "tracks.json");
  } catch (error) {
    // Fallback to relative path if process.cwd() fails
    console.warn("Error getting cwd, using relative path:", error);
    return "tracks.json";
  }
}

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
    const tracksFile = getTracksFilePath();
    if (await fs.pathExists(tracksFile)) {
      const tracksData = await fs.readJson(tracksFile);
      tracks.clear();
      if (Array.isArray(tracksData)) {
        tracksData.forEach((track: Track) => {
          if (track && track.id) {
            tracks.set(track.id, track);
          }
        });
      }
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
    const tracksFile = getTracksFilePath();
    const tracksArray = Array.from(tracks.values());
    await fs.writeJson(tracksFile, tracksArray, { spaces: 2 });
  } catch (error) {
    console.error("Error saving tracks to file:", error);
    // Don't throw - this is a non-critical operation
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
