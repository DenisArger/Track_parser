import {
  generateSafeFilename,
  normalizeForMatch,
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
  playlistId: number
): Promise<Set<string>> {
  const base = (apiUrl || "").replace(/\/$/, "");
  const set = new Set<string>();
  let offset = 0;

   
  while (true) {
    const url = `${base}/api/v2/playlists/${playlistId}/tracks/?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { "SC-API-KEY": apiKey },
    });

    if (!res.ok) {
      throw new Error(
        `Streaming.Center API error: ${res.status} ${res.statusText}`
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
      throw new Error(
        "Streaming.Center API: expected array of tracks" + hint
      );
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

export type SyncFromApiEntry = { normalizedName: string; rawName: string };

/**
 * Загружает все треки из плейлиста Streaming.Center и возвращает массив
 * { normalizedName, rawName } для сохранения в БД. Без вызова БД.
 */
export async function syncFromApi(
  apiUrl: string,
  apiKey: string,
  playlistId: number
): Promise<SyncFromApiEntry[]> {
  const base = (apiUrl || "").replace(/\/$/, "");
  const entries: SyncFromApiEntry[] = [];
  let offset = 0;

   
  while (true) {
    const url = `${base}/api/v2/playlists/${playlistId}/tracks/?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { "SC-API-KEY": apiKey },
    });

    if (!res.ok) {
      throw new Error(
        `Streaming.Center API error: ${res.status} ${res.statusText}`
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
      throw new Error(
        "Streaming.Center API: expected array of tracks" + hint
      );
    }

    for (const row of rows) {
      const rawName = nameFromRow(row);
      const normalizedName = normalizeForMatch(rawName);
      if (normalizedName) {
        entries.push({ normalizedName, rawName });
      }
    }

    if (rows.length > 0 && entries.length === 0 && offset === 0) {
      console.warn(
        "[Radio sync] Элементы без filename/name/meta/public_path. Ключи первого:",
        Object.keys(rows[0] || {}).join(", ")
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
  radioSet: Set<string>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const t of tracks) {
    const our = generateSafeFilename(t.metadata);
    const key = normalizeForMatch(our);
    result[t.id] = key ? radioSet.has(key) : false;
  }

  return result;
}
