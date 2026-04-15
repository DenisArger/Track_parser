const DEFAULT_PAGE_SIZE = 2000;

export type GridEvent = {
  id?: number | null;
  server?: number | null;
  name?: string | null;
  periodicity?: string | null;
  cast_type?: string | null;
  break_track?: boolean | null;
  start_playlist_from_beginning?: boolean | null;
  start_date?: string | null;
  start_time?: string | null;
  finish_date?: string | null;
  finish_time?: string | null;
  playlist?: number | null;
  playlist_after_radioshow?: number | null;
  rotation_after_radioshow?: number | null;
  dj?: number | null;
  rotation?: number | null;
  allow_jingles?: boolean | null;
  allow_song_requests?: boolean | null;
  allow_jingles_after?: boolean | null;
  allow_song_requests_after?: boolean | null;
  color?: string | null;
  color2?: string | null;
  local_time?: string | null;
  timezone?: string | null;
  parent_id?: number | null;
  start_ts?: number | null;
  start_ts_utc_readable?: string | null;
  end_ts?: number | null;
  wd_mon?: boolean | null;
  wd_tue?: boolean | null;
  wd_wed?: boolean | null;
  wd_thu?: boolean | null;
  wd_fri?: boolean | null;
  wd_sat?: boolean | null;
  wd_sun?: boolean | null;
  week_1?: boolean | null;
  week_2?: boolean | null;
  week_3?: boolean | null;
  week_4?: boolean | null;
  [key: string]: unknown;
};

export type GridEventInput = {
  server: number;
  name: string;
  periodicity: "onetime" | "periodic";
  cast_type: "playlist" | "radioshow" | "relay" | "rotation";
  break_track?: boolean;
  start_playlist_from_beginning?: boolean;
  start_date: string;
  start_time: string;
  finish_date?: string;
  finish_time?: string;
  playlist?: number | null;
  playlist_after_radioshow?: number | null;
  rotation_after_radioshow?: number | null;
  dj?: number | null;
  rotation?: number | null;
  allow_jingles?: boolean;
  allow_song_requests?: boolean;
  allow_jingles_after?: boolean;
  allow_song_requests_after?: boolean;
  color?: string;
  color2?: string | null;
  local_time?: string;
  timezone?: string;
  wd_mon?: boolean;
  wd_tue?: boolean;
  wd_wed?: boolean;
  wd_thu?: boolean;
  wd_fri?: boolean;
  wd_sat?: boolean;
  wd_sun?: boolean;
  week_1?: boolean;
  week_2?: boolean;
  week_3?: boolean;
  week_4?: boolean;
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

function buildAuthHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: apiKey.startsWith("JWT ") ? apiKey : `JWT ${apiKey}`,
  };
}

function sanitizeToken(apiKey: string): string {
  return apiKey.replace(/^JWT\s+/i, "");
}

function describeAuthHeaders(apiKey: string): Record<string, string> {
  const token = sanitizeToken(apiKey);
  return {
    Authorization: token ? `JWT ${token.slice(0, 2)}***${token.slice(-2)}` : "<empty>",
  };
}

function parseBodyMessage(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (!data || typeof data !== "object") return "";
  const obj = data as { detail?: string; error?: string; message?: string };
  return obj.detail || obj.error || obj.message || "";
}

function friendlyStreamingCenterMessage(message: string): string {
  const normalized = message.trim();
  if (!normalized) return normalized;
  if (normalized.toLowerCase().includes("authentication credentials were not provided")) {
    return (
      "Streaming.Center требует `Authorization: JWT <token>` для этой операции. " +
      "Проверьте, что STREAMING_CENTER_API_KEY задан и передаётся в HTTP-заголовке."
    );
  }
  return normalized;
}

async function readResponse(res: Response, url: string) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  let data: unknown = text;

  if (text && (contentType.includes("application/json") || text.startsWith("{") || text.startsWith("["))) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Streaming.Center вернул невалидный JSON (${url}): ${message}`);
    }
  }

  if (!res.ok) {
    const message = parseBodyMessage(data) || `Streaming.Center API error: ${res.status} ${res.statusText}`;
    console.error("[streamingCenterGridClient] response error", {
      url,
      status: res.status,
      statusText: res.statusText,
      contentType,
      rawText: text.slice(0, 800),
      parsedMessage: message,
    });
    throw new Error(friendlyStreamingCenterMessage(message));
  }

  return data;
}

function toQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function unwrapGridItems(data: unknown): GridEvent[] {
  if (Array.isArray(data)) return data as GridEvent[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const arr = obj.results ?? obj.data ?? obj.items ?? obj.events;
  return Array.isArray(arr) ? (arr as GridEvent[]) : [];
}

export async function fetchGridEvents(
  apiUrl: string,
  apiKey: string,
  params: {
    server: number;
    startTs: number;
    endTs: number;
    utc?: 0 | 1;
  }
): Promise<GridEvent[]> {
  const base = normalizeApiBase(apiUrl);
  const url = `${base}/api/v2/grid/${toQueryString({
    server: params.server,
    start_ts: params.startTs,
    end_ts: params.endTs,
    utc: params.utc ?? 1,
  })}`;
  const headers = buildAuthHeaders(apiKey);
  console.info("[streamingCenterGridClient] read request", {
    method: "GET",
    url,
    headers: describeAuthHeaders(apiKey),
  });
  const res = await fetch(url, { headers });
  return unwrapGridItems(await readResponse(res, url));
}

async function writeGridEvent(
  method: "POST" | "PUT",
  apiUrl: string,
  apiKey: string,
  payload: GridEventInput,
  id?: number
): Promise<GridEvent> {
  const base = normalizeApiBase(apiUrl);
  const url = id ? `${base}/api/v2/grid/${id}/` : `${base}/api/v2/grid/`;
  const headers = {
    ...buildAuthHeaders(apiKey),
    "Content-Type": "application/json",
  };
  console.info("[streamingCenterGridClient] write request", {
    method,
    url,
    headers: describeAuthHeaders(apiKey),
    payloadKeys: Object.keys(payload),
    payloadSummary: {
      server: payload.server,
      name: payload.name,
      periodicity: payload.periodicity,
      cast_type: payload.cast_type,
      start_date: payload.start_date,
      start_time: payload.start_time,
      finish_date: payload.finish_date ?? null,
      finish_time: payload.finish_time ?? null,
      playlist: payload.playlist ?? null,
      playlist_after_radioshow: payload.playlist_after_radioshow ?? null,
      rotation_after_radioshow: payload.rotation_after_radioshow ?? null,
      dj: payload.dj ?? null,
      rotation: payload.rotation ?? null,
      timezone: payload.timezone ?? null,
      color: payload.color ?? null,
      color2: payload.color2 ?? null,
      break_track: payload.break_track ?? null,
      start_playlist_from_beginning: payload.start_playlist_from_beginning ?? null,
    },
  });
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(payload),
  });
  const data = await readResponse(res, url);
  if (Array.isArray(data)) return (data[0] as GridEvent) ?? payload;
  return (data as GridEvent) || payload;
}

export function createGridEvent(
  apiUrl: string,
  apiKey: string,
  payload: GridEventInput
): Promise<GridEvent> {
  return writeGridEvent("POST", apiUrl, apiKey, payload, undefined);
}

export function updateGridEvent(
  apiUrl: string,
  apiKey: string,
  id: number,
  payload: GridEventInput
): Promise<GridEvent> {
  return writeGridEvent("PUT", apiUrl, apiKey, payload, id);
}

export async function deleteGridEvent(
  apiUrl: string,
  apiKey: string,
  id: number
): Promise<void> {
  const base = normalizeApiBase(apiUrl);
  const url = `${base}/api/v2/grid/${id}/`;
  const headers = buildAuthHeaders(apiKey);
  console.info("[streamingCenterGridClient] delete request", {
    method: "DELETE",
    url,
    headers: describeAuthHeaders(apiKey),
  });
  const res = await fetch(url, {
    method: "DELETE",
    headers,
  });
  await readResponse(res, url);
}

export function buildDateRange(startDate: string, days: number): { startTs: number; endTs: number } {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(1, days));
  return {
    startTs: Math.floor(start.getTime() / 1000),
    endTs: Math.floor(end.getTime() / 1000),
  };
}

export function getGridPageSize(): number {
  return DEFAULT_PAGE_SIZE;
}
