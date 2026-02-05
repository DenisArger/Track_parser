import {
  generateSafeFilename,
  normalizeForMatch,
  parseArtistTitleFromRawName,
} from "@/lib/utils/filenameUtils";

const PAGE_SIZE = 1000;

type PlaylistTrackRow = {
  filename?: string;
  name?: string;
  meta?: string;
  public_path?: string;
  track?: Record<string, unknown>;
  [key: string]: unknown;
};

function normalizeApiBase(apiUrl: string): string {
  const trimmed = (apiUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const v2 = "/api/v2";
  if (trimmed.endsWith(v2)) {
    return trimmed.slice(0, -v2.length);
  }
  return trimmed;
}

function getBasename(p: string): string {
  const s = (p || "").trim();
  if (!s) return "";
  const parts = s.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "";
}

function nameFromNested(obj: Record<string, unknown>): string {
  const filename = obj.filename ? String(obj.filename).trim() : "";
  if (filename) return filename;

  const name = obj.name ? String(obj.name).trim() : "";
  if (name) return name;

  const meta = obj.meta ? String(obj.meta).trim() : "";
  if (meta) return meta;

  if (obj.public_path) {
    const basename = getBasename(String(obj.public_path));
    if (basename) return basename;
  }

  if (obj.path) {
    const basename = getBasename(String(obj.path));
    if (basename) return basename;
  }

  return "";
}

function nameFromRow(row: PlaylistTrackRow): string {
  const t = row.track;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const v = nameFromNested(t as Record<string, unknown>);
    if (v) return v;
  }

  const filename = row.filename ? String(row.filename).trim() : "";
  if (filename) return filename;

  const name = row.name ? String(row.name).trim() : "";
  if (name) return name;

  const meta = row.meta ? String(row.meta).trim() : "";
  if (meta) return meta;

  if (row.public_path) {
    const basename = getBasename(String(row.public_path));
    if (basename) return basename;
  }

  return "";
}

/**
 * Загружает все имена треков из плейлиста Streaming.Center с пагинацией.
 * Возвращает Set нормализованных имён (lowercase, trim, без .mp3) для сопоставления.
 */
export async function getAllPlaylistTrackNames(
  apiUrl: string,
  apiKey: string,
  playlistId: number,
): Promise<Set<string>> {
  const base = normalizeApiBase(apiUrl);
  const set = new Set<string>();
  let offset = 0;

  while (true) {
    const url = `${base}/api/v2/playlists/${playlistId}/tracks/?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { "SC-API-KEY": apiKey },
    });

    if (!res.ok) {
      throw new Error(
        `Streaming.Center API error: ${res.status} ${res.statusText}`,
      );
    }

    const data: unknown = await res.json();
    let rows: PlaylistTrackRow[] = [];

    if (Array.isArray(data)) {
      rows = data as PlaylistTrackRow[];
    } else if (data && typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const arr =
        obj.results ??
        obj.tracks ??
        obj.data ??
        obj.items ??
        obj.files ??
        obj.playlist_files ??
        obj.list ??
        obj.records;
      if (Array.isArray(arr)) {
        rows = arr as PlaylistTrackRow[];
      }
    }

    if (!Array.isArray(rows)) {
      const hint =
        data && typeof data === "object"
          ? ` (keys: ${Object.keys(data as object).join(", ")})`
          : ` (type: ${typeof data})`;
      throw new Error("Streaming.Center API: expected array of tracks" + hint);
    }

    for (const row of rows) {
      const name = nameFromRow(row);
      const norm = normalizeForMatch(name);
      if (norm) set.add(norm);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return set;
}

export type SyncFromApiEntry = {
  normalizedName: string;
  rawName: string;
  artist?: string | null;
  title?: string | null;
  trackType?: string | null;
  year?: number | null;
  rating?: number | null;
};

function getStringValue(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): string {
  if (!obj) return "";
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseYear(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < 1900 || n > 2100) return null;
  return n;
}

function parseRating(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const n = Math.trunc(value);
    return n >= 1 && n <= 10 ? n : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/\d+/);
    if (!match) return null;
    const n = parseInt(match[0], 10);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
  }
  return null;
}

function normalizeTrackType(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  const lower = s.toLowerCase();
  if (["быстрый", "fast", "quick"].includes(lower)) return "Быстрый";
  if (["средний", "medium", "mid"].includes(lower)) return "Средний";
  if (["медленный", "slow"].includes(lower)) return "Медленный";
  if (["модерн", "modern"].includes(lower)) return "Модерн";
  if (["Быстрый", "Средний", "Медленный", "Модерн"].includes(s)) return s;
  return null;
}

function parseTrackTypeFromText(text: string): string | null {
  const s = (text || "").toLowerCase();
  if (!s) return null;
  if (s.includes("быстрый")) return "Быстрый";
  if (s.includes("средний")) return "Средний";
  if (s.includes("медленный")) return "Медленный";
  if (s.includes("модерн") || s.includes("modern")) return "Модерн";
  return null;
}

function parseMetaString(meta: string): {
  artist?: string | null;
  title?: string | null;
  trackType?: string | null;
  year?: number | null;
  rating?: number | null;
} {
  const trimmed = (meta || "").trim();
  if (!trimmed) return {};

  // Try JSON first
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const artist = getStringValue(obj, ["artist", "Artist", "ARTIST"]);
      const title = getStringValue(obj, ["title", "Title", "TITLE"]);
      const trackType = normalizeTrackType(
        obj.track_type ?? obj.type ?? obj.genre ?? obj.trackType,
      );
      const year = parseYear(obj.year ?? obj.Year ?? obj.date);
      const rating = parseRating(
        obj.track_number ??
          obj.trackNumber ??
          obj.track_no ??
          obj.trackNo ??
          obj.track ??
          obj.number ??
          obj.no ??
          obj.rating,
      );
      return {
        artist: artist || undefined,
        title: title || undefined,
        trackType: trackType || undefined,
        year: year || undefined,
        rating: rating ?? undefined,
      };
    } catch {
      // fall through
    }
  }

  return {};
}

function extractMetadataFromRow(
  row: PlaylistTrackRow,
  rawName: string,
): {
  artist: string | null;
  title: string | null;
  trackType: string | null;
  year: number | null;
  rating: number | null;
} {
  const trackObj =
    row.track && typeof row.track === "object" && !Array.isArray(row.track)
      ? (row.track as Record<string, unknown>)
      : undefined;

  const artist =
    getStringValue(trackObj, ["artist", "Artist"]) ||
    getStringValue(row as Record<string, unknown>, ["artist", "Artist"]);

  const title =
    getStringValue(trackObj, ["title", "Title", "name", "Name"]) ||
    getStringValue(row as Record<string, unknown>, ["title", "Title"]);

  const trackType = normalizeTrackType(
    (trackObj && (trackObj.track_type ?? trackObj.type ?? trackObj.genre)) ||
      (row as Record<string, unknown>).track_type ||
      (row as Record<string, unknown>).type ||
      (row as Record<string, unknown>).genre,
  );

  const commentText =
    getStringValue(trackObj, [
      "comment",
      "comments",
      "note",
      "notes",
      "remark",
      "description",
      "desc",
    ]) ||
    getStringValue(row as Record<string, unknown>, [
      "comment",
      "comments",
      "note",
      "notes",
      "remark",
      "description",
      "desc",
    ]);

  const year =
    parseYear(trackObj?.year) ??
    parseYear((row as Record<string, unknown>).year);

  let metaParsed: ReturnType<typeof parseMetaString> = {};
  const metaString =
    (trackObj && typeof trackObj.meta === "string" ? trackObj.meta : "") ||
    (typeof row.meta === "string" ? row.meta : "");
  if (metaString) {
    metaParsed = parseMetaString(metaString);
  }

  const rating = parseRating(
    (trackObj &&
      (trackObj.track_number ??
        trackObj.trackNumber ??
        trackObj.track_no ??
        trackObj.trackNo ??
        trackObj.track ??
        trackObj.number ??
        trackObj.no)) ||
      (row as Record<string, unknown>).track_number ||
      (row as Record<string, unknown>).trackNumber ||
      (row as Record<string, unknown>).track_no ||
      (row as Record<string, unknown>).trackNo ||
      (row as Record<string, unknown>).track ||
      (row as Record<string, unknown>).number ||
      (row as Record<string, unknown>).no ||
      (row as Record<string, unknown>).rating,
  );

  const parsedFromRaw = parseArtistTitleFromRawName(rawName);

  return {
    artist: artist || metaParsed.artist || parsedFromRaw.artist || null,
    title: title || metaParsed.title || parsedFromRaw.title || null,
    trackType:
      trackType ||
      metaParsed.trackType ||
      parseTrackTypeFromText(commentText) ||
      null,
    year: year ?? metaParsed.year ?? null,
    rating: rating ?? metaParsed.rating ?? null,
  };
}

/**
 * Загружает все треки из плейлиста Streaming.Center и возвращает массив
 * { normalizedName, rawName } для сохранения в БД. Без вызова БД.
 */
export async function syncFromApi(
  apiUrl: string,
  apiKey: string,
  playlistId: number,
): Promise<SyncFromApiEntry[]> {
  const base = normalizeApiBase(apiUrl);
  const entries: SyncFromApiEntry[] = [];
  let offset = 0;

  while (true) {
    const url = `${base}/api/v2/playlists/${playlistId}/tracks/?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { "SC-API-KEY": apiKey },
    });

    if (!res.ok) {
      throw new Error(
        `Streaming.Center API error: ${res.status} ${res.statusText}`,
      );
    }

    const data: unknown = await res.json();
    let rows: PlaylistTrackRow[] = [];

    if (Array.isArray(data)) {
      rows = data as PlaylistTrackRow[];
    } else if (data && typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const arr =
        obj.results ??
        obj.tracks ??
        obj.data ??
        obj.items ??
        obj.files ??
        obj.playlist_files ??
        obj.list ??
        obj.records;
      if (Array.isArray(arr)) {
        rows = arr as PlaylistTrackRow[];
      }
    }

    if (!Array.isArray(rows)) {
      const hint =
        data && typeof data === "object"
          ? ` (keys: ${Object.keys(data as object).join(", ")})`
          : ` (type: ${typeof data})`;
      throw new Error("Streaming.Center API: expected array of tracks" + hint);
    }

    for (const row of rows) {
      const rawName = nameFromRow(row);
      const normalizedName = normalizeForMatch(rawName);
      if (normalizedName) {
        const meta = extractMetadataFromRow(row, rawName);
        entries.push({
          normalizedName,
          rawName,
          artist: meta.artist,
          title: meta.title,
          trackType: meta.trackType,
          year: meta.year,
          rating: meta.rating,
        });
      }
    }

    if (rows.length > 0 && entries.length === 0 && offset === 0) {
      console.warn(
        "[Radio sync] Элементы без filename/name/meta/public_path. Ключи первого:",
        Object.keys(rows[0] || {}).join(", "),
      );
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return entries;
}

export type TrackForCheck = {
  id: string;
  metadata: { title?: string; artist?: string };
};

/**
 * Проверяет, какие треки уже есть в плейлисте (на радио).
 * radioSet — Set нормализованных имён из БД (или API).
 * Возвращает Record<trackId, boolean>.
 */
export function checkTracksOnRadio(
  tracks: TrackForCheck[],
  radioSet: Set<string>,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const t of tracks) {
    const our = generateSafeFilename(t.metadata);
    const key = normalizeForMatch(our);
    result[t.id] = key ? radioSet.has(key) : false;
  }

  return result;
}
