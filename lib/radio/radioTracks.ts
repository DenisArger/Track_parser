import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncFromApi } from "./streamingCenterClient";
import { parseArtistTitleFromRawName } from "@/lib/utils/filenameUtils";

const PAGE_SIZE = 1000;

/**
 * Возвращает Set нормализованных имён треков на радио из БД.
 * Если таблица пуста и заданы STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY —
 * подтягивает данные из API, сохраняет в БД и возвращает Set.
 */
export async function getRadioTrackNamesSet(): Promise<Set<string>> {
  const supabase = createSupabaseServerClient();
  const set = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("radio_tracks")
      .select("normalized_name")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = data || [];
    for (const row of rows) {
      if (row?.normalized_name) {
        set.add(row.normalized_name);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  const debugKey =
    "ц.краеугольный камень (новосибирск) & наталья доценко - господь велик";
  console.log("[radio tracks] set loaded", {
    count: set.size,
    debugKey,
    hasDebugKey: set.has(debugKey),
  });

  const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
  const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
  const playlistId =
    parseInt(process.env.STREAMING_CENTER_PLAYLIST_ID || "1", 10) || 1;

  if (set.size === 0 && apiUrl && apiKey) {
    const entries = await syncFromApi(apiUrl, apiKey, playlistId);
    if (entries.length > 0) {
      await supabase.from("radio_tracks").upsert(
        entries.map((e) => {
          const parsed = parseArtistTitleFromRawName(e.rawName);
          const artist = e.artist ?? parsed.artist;
          const title = e.title ?? parsed.title;
          return {
            normalized_name: e.normalizedName,
            raw_name: e.rawName,
            artist,
            title,
            track_type: e.trackType ?? null,
            year: e.year ?? null,
            rating: e.rating ?? null,
            source: "api_sync",
          };
        }),
        { onConflict: "normalized_name" }
      );
    }
    for (const entry of entries) {
      set.add(entry.normalizedName);
    }
  }

  return set;
}

/**
 * Принудительно загружает треки с Streaming.Center в radio_tracks.
 * Всегда обращается к API. Новые имена добавляются, существующие не перезаписываются.
 * Возвращает количество треков, полученных из API.
 */
export async function syncRadioTracksFromApi(): Promise<{ count: number }> {
  const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
  const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
  const playlistId =
    parseInt(process.env.STREAMING_CENTER_PLAYLIST_ID || "1", 10) || 1;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  if (!apiUrl || !apiKey) {
    throw new Error(
      "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы"
    );
  }

  const entries = await syncFromApi(apiUrl, apiKey, playlistId);

  if (entries.length > 0) {
    const byNormalized = new Map<string, (typeof entries)[number]>();
    for (const e of entries) {
      byNormalized.set(e.normalizedName, e);
    }
    const uniqueEntries = Array.from(byNormalized.values());

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("radio_tracks").upsert(
      uniqueEntries.map((e) => {
        const parsed = parseArtistTitleFromRawName(e.rawName);
        const artist = e.artist ?? parsed.artist;
        const title = e.title ?? parsed.title;
        return {
          normalized_name: e.normalizedName,
          raw_name: e.rawName,
          artist,
          title,
          track_type: e.trackType ?? null,
          year: e.year ?? null,
          rating: e.rating ?? null,
          source: "api_sync",
        };
      }),
      { onConflict: "normalized_name" }
    );
    console.log(
      "[radio sync] upsert to radio_tracks",
      {
        count: uniqueEntries.length,
        supabaseUrl,
        playlistId,
        apiUrl,
      }
    );
    if (error) {
      console.error("[radio sync] supabase error:", error);
      throw new Error(`Ошибка записи в radio_tracks: ${error.message}`);
    }
  }

  return { count: entries.length };
}

/**
 * Добавляет трек в radio_tracks (после FTP-загрузки).
 * При конфликте по normalized_name — не обновляет (idempotent).
 */
export async function addRadioTrack(p: {
  normalizedName: string;
  rawName: string;
  trackType?: string | null;
  year?: number | null;
  rating?: number | null;
  source?: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const parsed = parseArtistTitleFromRawName(p.rawName);
  await supabase.from("radio_tracks").upsert(
    {
      normalized_name: p.normalizedName,
      raw_name: p.rawName,
      artist: parsed.artist,
      title: parsed.title,
      track_type: p.trackType ?? null,
      year: p.year ?? null,
      rating: p.rating ?? null,
      source: p.source || "ftp_upload",
    },
    { onConflict: "normalized_name", ignoreDuplicates: true }
  );
}
