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
    if (typeof process === "undefined" || !process.env) {
      return "/tmp/tracks.json";
    }

    // Check if we're in build phase - this is the most reliable check
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "/tmp/tracks.json";
    }

    // Additional safety check: if we're in production but don't have runtime indicators
    // This helps catch cases where static generation is happening
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.NETLIFY_URL &&
      !process.env.VERCEL_URL &&
      !process.env.AWS_LAMBDA_FUNCTION_NAME
    ) {
      // Likely static generation, return /tmp to avoid file system access
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:66',message:'loadTracksFromFile entry',data:{hasWindow:typeof window!=='undefined',hasProcess:typeof process!=='undefined',hasEnv:typeof process!=='undefined'&&!!process.env},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    // Skip file loading in client-side or build-time
    if (typeof window !== "undefined") {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:70',message:'loadTracksFromFile client-side skip',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      isInitialized = true;
      return;
    }

    // Early check for build-time environment before any imports
    if (typeof process !== "undefined" && process.env) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:76',message:'loadTracksFromFile env check',data:{nextPhase:process.env.NEXT_PHASE,nodeEnv:process.env.NODE_ENV,netlifyUrl:process.env.NETLIFY_URL,vercelUrl:process.env.VERCEL_URL,awsLambda:process.env.AWS_LAMBDA_FUNCTION_NAME},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (process.env.NEXT_PHASE === "phase-production-build") {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:77',message:'loadTracksFromFile build phase skip',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        isInitialized = true;
        return;
      }
      
      // Additional safety check: if we're in production but don't have runtime indicators
      // This helps catch cases where static generation is happening
      // BUT: In Netlify, NETLIFY=true is set, so we should check for that too
      const isNetlify = !!process.env.NETLIFY;
      const hasRuntimeIndicator = 
        process.env.NETLIFY_URL ||
        process.env.VERCEL_URL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        isNetlify;
      
      if (
        process.env.NODE_ENV === "production" &&
        !hasRuntimeIndicator
      ) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:89',message:'loadTracksFromFile static gen skip',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error("[DEBUG] loadTracksFromFile: Static generation detected, skipping file load", {
          nodeEnv: process.env.NODE_ENV,
          netlify: process.env.NETLIFY,
          netlifyUrl: process.env.NETLIFY_URL,
          hasRuntimeIndicator
        });
        // Likely static generation, skip file loading
        isInitialized = true;
        return;
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:96',message:'loadTracksFromFile before fs import',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // Dynamic import to avoid issues during static generation
    const fs = await import("fs-extra");
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:97',message:'loadTracksFromFile after fs import',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const {
      isServerlessEnvironment,
      getSafeWorkingDirectory,
      isFileSystemWritable,
    } = await import("@/lib/utils/environment");

    const tracksFile = await getTracksFilePath();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:103',message:'loadTracksFromFile tracks file path',data:{tracksFile},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // Skip if file path is empty (client-side)
    if (!tracksFile) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:106',message:'loadTracksFromFile empty path skip',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      isInitialized = true;
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:111',message:'loadTracksFromFile before pathExists',data:{tracksFile},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (await fs.pathExists(tracksFile)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:112',message:'loadTracksFromFile file exists',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:178',message:'loadTracksFromFile success',data:{tracksCount:tracks.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    isInitialized = true;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:180',message:'loadTracksFromFile catch error',data:{errorMessage:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[DEBUG] loadTracksFromFile: Error loading tracks from file", {
      errorMessage,
      errorStack,
      nodeEnv: typeof process !== "undefined" && process.env ? process.env.NODE_ENV : "unknown",
      netlify: typeof process !== "undefined" && process.env ? process.env.NETLIFY : "unknown",
      nextPhase: typeof process !== "undefined" && process.env ? process.env.NEXT_PHASE : "unknown"
    });
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:191',message:'ensureInitialized entry',data:{isInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  if (isInitialized) {
    return;
  }

  if (!initializationPromise) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:197',message:'ensureInitialized creating promise',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    initializationPromise = (async () => {
      try {
        await loadTracksFromFile();
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:200',message:'ensureInitialized promise error',data:{errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:212',message:'ensureInitialized promise resolved',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cb117245-0fa8-4993-97a2-913e34cda7ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/storage/trackStorage.ts:215',message:'ensureInitialized catch error',data:{errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
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
