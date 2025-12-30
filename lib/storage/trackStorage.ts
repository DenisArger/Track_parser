// Dynamic imports to avoid issues during static generation
// These modules are only imported when needed, not at module load time
import type { Track } from "@/types/track";

// Lazy evaluation of tracks file path to avoid issues in production
// Compute path when needed, not at module import time
async function getTracksFilePath(): Promise<string> {
  try {
    // Check if we're in a build-time environment (static generation) or client-side
    if (typeof window !== "undefined") {
      // Client-side: return empty, tracks will be loaded via API
      return "";
    }

    // Check if process is available (might not be in some edge cases)
    if (typeof process === "undefined" || typeof process.cwd !== "function") {
      return "/tmp/tracks.json";
    }

    // Check if we're in build phase
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "/tmp/tracks.json";
    }

    // Dynamic import to avoid issues during static generation
    const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");
    const path = await import("path");
    const workingDir = getSafeWorkingDirectory();
    return path.join(workingDir, "tracks.json");
  } catch (error) {
    // Fallback to /tmp if everything fails
    console.warn("Error getting tracks file path, using /tmp:", error);
    return "/tmp/tracks.json";
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
 * Safe for production - never throws errors
 */
export async function loadTracksFromFile(): Promise<void> {
  try {
    // Skip file loading in client-side or build-time
    if (typeof window !== "undefined") {
      isInitialized = true;
      return;
    }

    // Dynamic import to avoid issues during static generation
    const fs = await import("fs-extra");
    const {
      isServerlessEnvironment,
      getSafeWorkingDirectory,
      isFileSystemWritable,
    } = await import("@/lib/utils/environment");

    const tracksFile = await getTracksFilePath();

    // Skip if file path is empty (client-side)
    if (!tracksFile) {
      isInitialized = true;
      return;
    }

    if (await fs.pathExists(tracksFile)) {
      const tracksData = await fs.readJson(tracksFile);
      tracks.clear();
      if (Array.isArray(tracksData)) {
        tracksData.forEach((track: Track) => {
          // Validate track structure before adding
          if (
            track &&
            track.id &&
            track.metadata &&
            typeof track.metadata === "object"
          ) {
            // Ensure all required fields exist
            const validTrack: Track = {
              id: String(track.id),
              filename: String(track.filename || ""),
              originalPath: String(track.originalPath || ""),
              processedPath: track.processedPath
                ? String(track.processedPath)
                : undefined,
              metadata: {
                title: String(track.metadata.title || ""),
                artist: String(track.metadata.artist || ""),
                album: String(track.metadata.album || ""),
                genre: track.metadata.genre || "Средний",
                rating: Number(track.metadata.rating || 0),
                year: Number(track.metadata.year || 0),
                duration: track.metadata.duration
                  ? Number(track.metadata.duration)
                  : undefined,
                bpm: track.metadata.bpm
                  ? Number(track.metadata.bpm)
                  : undefined,
                isTrimmed: Boolean(track.metadata.isTrimmed),
                trimSettings: track.metadata.trimSettings
                  ? {
                      startTime: Number(
                        track.metadata.trimSettings.startTime || 0
                      ),
                      endTime: track.metadata.trimSettings.endTime
                        ? Number(track.metadata.trimSettings.endTime)
                        : undefined,
                      fadeIn: Number(track.metadata.trimSettings.fadeIn || 0),
                      fadeOut: Number(track.metadata.trimSettings.fadeOut || 0),
                      maxDuration: track.metadata.trimSettings.maxDuration
                        ? Number(track.metadata.trimSettings.maxDuration)
                        : undefined,
                    }
                  : undefined,
              },
              status: String(track.status || "downloaded") as Track["status"],
              downloadProgress: track.downloadProgress
                ? Number(track.downloadProgress)
                : undefined,
              processingProgress: track.processingProgress
                ? Number(track.processingProgress)
                : undefined,
              uploadProgress: track.uploadProgress
                ? Number(track.uploadProgress)
                : undefined,
              error: track.error ? String(track.error) : undefined,
            };
            tracks.set(validTrack.id, validTrack);
          }
        });
      }
    }
    isInitialized = true;
  } catch (error) {
    console.error("Error loading tracks from file:", error);
    // Continue with empty storage if file doesn't exist or can't be read
    // This is not an error condition - app can work with empty storage
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
    initializationPromise = (async () => {
      try {
        await loadTracksFromFile();
      } catch (error) {
        // Ensure we mark as initialized even if loading fails
        console.error("Failed to initialize tracks storage:", error);
        // Continue with empty storage - this is not an error condition
      } finally {
        // Always mark as initialized, even if loading failed
        isInitialized = true;
      }
    })();
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
    // Skip file saving in client-side
    if (typeof window !== "undefined") {
      return;
    }

    // Dynamic import to avoid issues during static generation
    const fs = await import("fs-extra");
    const { isServerlessEnvironment, isFileSystemWritable } = await import(
      "@/lib/utils/environment"
    );

    // In serverless environments, file system might be read-only
    // We skip saving to file and rely on in-memory storage
    if (isServerlessEnvironment()) {
      const isWritable = await isFileSystemWritable();
      if (!isWritable) {
        console.warn(
          "File system is not writable in serverless environment, skipping save"
        );
        return;
      }
    }

    const tracksFile = await getTracksFilePath();
    const tracksArray = Array.from(tracks.values());
    await fs.writeJson(tracksFile, tracksArray, { spaces: 2 });
  } catch (error) {
    console.error("Error saving tracks to file:", error);
    // Don't throw - this is a non-critical operation
    // In serverless, we continue with in-memory storage
  }
}

/**
 * Получает все треки
 * Safe for production - never throws errors
 */
export async function getAllTracks(): Promise<Track[]> {
  try {
    await ensureInitialized();
    return Array.from(tracks.values());
  } catch (error) {
    // Never throw - return empty array to prevent Server Component errors
    console.error("Error in getAllTracks (storage):", error);
    return [];
  }
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
