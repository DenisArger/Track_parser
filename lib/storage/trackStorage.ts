import type { Track, TrackStatus } from "@/types/track";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteFileFromStorage,
  getBucketForOriginalPath,
  isStoragePath,
  STORAGE_BUCKETS,
  clearBucket,
} from "./supabaseStorage";

// Database row type (matches Supabase schema)
interface TrackRow {
  id: string;
  filename: string;
  original_path: string | null;
  processed_path: string | null;
  status: string;
  metadata: Record<string, any>;
  download_progress: number | null;
  processing_progress: number | null;
  upload_progress: number | null;
  error: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Преобразует строку базы данных в Track
 */
function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    filename: row.filename,
    originalPath: row.original_path || "",
    processedPath: row.processed_path || undefined,
    metadata: {
      title: row.metadata.title || "",
      artist: row.metadata.artist || "",
      album: row.metadata.album || "",
      genre: row.metadata.genre || "Средний",
      rating: row.metadata.rating || 0,
      year: row.metadata.year || 0,
      duration: row.metadata.duration,
      bpm: row.metadata.bpm,
      isTrimmed: row.metadata.isTrimmed,
      trimSettings: row.metadata.trimSettings,
      sourceUrl: row.metadata.sourceUrl,
      sourceType: row.metadata.sourceType,
    },
    status: row.status as TrackStatus,
    downloadProgress: row.download_progress ?? undefined,
    processingProgress: row.processing_progress ?? undefined,
    uploadProgress: row.upload_progress ?? undefined,
    error: row.error || undefined,
  };
}

/**
 * Преобразует Track в формат для базы данных
 */
function trackToRow(track: Track): Omit<TrackRow, "created_at" | "updated_at"> {
  return {
    id: track.id,
    filename: track.filename,
    original_path: track.originalPath || null,
    processed_path: track.processedPath || null,
    status: track.status,
    metadata: {
      title: track.metadata.title,
      artist: track.metadata.artist,
      album: track.metadata.album,
      genre: track.metadata.genre,
      rating: track.metadata.rating,
      year: track.metadata.year,
      duration: track.metadata.duration,
      bpm: track.metadata.bpm,
      isTrimmed: track.metadata.isTrimmed,
      trimSettings: track.metadata.trimSettings,
      sourceUrl: track.metadata.sourceUrl,
      sourceType: track.metadata.sourceType,
    },
    download_progress: track.downloadProgress ?? null,
    processing_progress: track.processingProgress ?? null,
    upload_progress: track.uploadProgress ?? null,
    error: track.error || null,
  };
}

/**
 * Генерирует уникальный ID для трека (UUID)
 * В Supabase используется UUID, но для обратной совместимости можем генерировать строку
 */
export function generateTrackId(): string {
  // Используем crypto.randomUUID если доступен, иначе fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для старых окружений
  return `${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
}

/**
 * Получает все треки из Supabase
 * Safe for production - never throws errors
 */
export async function getAllTracks(): Promise<Track[]> {
  try {
    // Skip in build-time environment
    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PHASE === "phase-production-build"
    ) {
      return [];
    }

    // Additional check for static generation
    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV === "production" &&
      !process.env.NETLIFY_URL &&
      !process.env.VERCEL_URL &&
      !process.env.AWS_LAMBDA_FUNCTION_NAME &&
      !process.env.NETLIFY
    ) {
      return [];
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tracks from Supabase:", error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data.map((row) => rowToTrack(row as TrackRow));
  } catch (error) {
    // Never throw - return empty array to prevent Server Component errors
    console.error("Error in getAllTracks (storage):", error);
    return [];
  }
}

/**
 * Получает трек по ID из Supabase
 */
export async function getTrack(trackId: string): Promise<Track | undefined> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .eq("id", trackId)
      .single();

    if (error) {
      console.error("Error fetching track from Supabase:", error);
      return undefined;
    }

    if (!data) {
      return undefined;
    }

    return rowToTrack(data as TrackRow);
  } catch (error) {
    console.error("Error in getTrack:", error);
    return undefined;
  }
}

/**
 * Сохраняет или обновляет трек в Supabase
 */
export async function setTrack(trackId: string, track: Track): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const row = trackToRow(track);

    // Проверяем, существует ли трек
    const { data: existing } = await supabase
      .from("tracks")
      .select("id")
      .eq("id", trackId)
      .single();

    if (existing) {
      // Обновляем существующий трек
      const { error } = await supabase
        .from("tracks")
        .update(row)
        .eq("id", trackId);

      if (error) {
        console.error("Error updating track in Supabase:", error);
        throw error;
      }
    } else {
      // Вставляем новый трек
      const { error } = await supabase.from("tracks").insert(row);

      if (error) {
        console.error("Error inserting track in Supabase:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Error in setTrack:", error);
    throw error;
  }
}

/**
 * Удаляет трек из Supabase (БД и файлы в Storage)
 */
export async function deleteTrack(trackId: string): Promise<void> {
  try {
    const track = await getTrack(trackId);
    if (track) {
      if (track.originalPath && isStoragePath(track.originalPath)) {
        try {
          const bucket = getBucketForOriginalPath(track.status);
          await deleteFileFromStorage(bucket, track.originalPath);
        } catch (e) {
          // 404 и прочие ошибки при удалении из Storage игнорируем
          console.warn("Error deleting original file from Storage (ignored):", e);
        }
      }
      if (track.processedPath && isStoragePath(track.processedPath)) {
        try {
          await deleteFileFromStorage(STORAGE_BUCKETS.processed, track.processedPath);
        } catch (e) {
          console.warn("Error deleting processed file from Storage (ignored):", e);
        }
      }
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("tracks").delete().eq("id", trackId);

    if (error) {
      console.error("Error deleting track from Supabase:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in deleteTrack:", error);
    throw error;
  }
}

/**
 * Удаляет все треки (БД) и очищает бакеты Storage: downloads, processed, rejected, previews.
 */
export async function deleteAllTracks(): Promise<{
  deleted: number;
  cleared: Record<string, number>;
}> {
  const tracks = await getAllTracks();
  for (const t of tracks) {
    await deleteTrack(t.id);
  }
  const cleared: Record<string, number> = {};
  const buckets = [
    STORAGE_BUCKETS.downloads,
    STORAGE_BUCKETS.processed,
    STORAGE_BUCKETS.rejected,
    STORAGE_BUCKETS.previews,
  ] as const;
  for (const name of buckets) {
    try {
      cleared[name] = await clearBucket(name);
    } catch (e) {
      console.warn(`Error clearing bucket ${name}:`, e);
      cleared[name] = 0;
    }
  }
  return { deleted: tracks.length, cleared };
}
