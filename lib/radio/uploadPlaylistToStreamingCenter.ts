import iconv from "iconv-lite";
import { generateSafeFilename } from "@/lib/utils/filenameUtils";

export type StreamingCenterTrack = {
  raw_name?: string | null;
  artist?: string | null;
  title?: string | null;
};

export interface UploadPlaylistBody {
  name: string;
  serverId?: number;
  isRandom?: boolean;
  basePath?: string;
  useWindows1251?: boolean;
  tracks: StreamingCenterTrack[];
}

export interface StreamingCenterUploadResult {
  status: number;
  json: unknown;
}

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

function joinBasePath(basePath: string, filename: string): string {
  const trimmedBase = (basePath || "").trim();
  if (!trimmedBase) return filename;
  const normalizedBase = trimmedBase.replace(/[\\/]+$/, "");
  const sep = normalizedBase.includes("\\") ? "\\" : "/";
  return `${normalizedBase}${sep}${filename}`;
}

function buildM3u(tracks: StreamingCenterTrack[], basePath: string): string {
  const lines: string[] = ["#EXTM3U"];
  for (const t of tracks) {
    const artist = (t.artist || "").trim();
    const title = (t.title || "").trim();
    const display = [artist, title].filter(Boolean).join(" - ");
    if (display) {
      lines.push(`#EXTINF:-1,${display}`);
    }
    const raw = (t.raw_name || "").trim();
    const hasPath = /[\\/]/.test(raw) || /^[a-zA-Z]:\\/.test(raw);
    let filename = raw ? getBasename(raw) : generateSafeFilename({ artist, title });
    if (filename && !/\.[a-z0-9]+$/i.test(filename)) {
      filename = `${filename}.mp3`;
    }
    const value = basePath
      ? joinBasePath(basePath, filename || raw)
      : hasPath
        ? raw
        : filename;
    if (value) lines.push(value);
  }
  return lines.join("\r\n");
}

/**
 * Выгрузка M3U в Streaming.Center (то же, что использует вкладка «Плейлист»).
 * Вынесено в общую функцию, чтобы месячные рубрики отправлялись «по аналогии».
 */
export async function uploadPlaylistToStreamingCenter(
  body: UploadPlaylistBody,
): Promise<StreamingCenterUploadResult> {
  const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
  const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
  if (!apiUrl || !apiKey) {
    return {
      status: 500,
      json: {
        error:
          "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы",
      },
    };
  }

  const base = normalizeApiBase(apiUrl);
  const safeName = body.name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "playlist";

  const form = new FormData();
  form.append("name", body.name);
  form.append("is_random", body.isRandom ? "True" : "False");
  form.append(
    "server",
    String(Number.isFinite(body.serverId) ? body.serverId : 1),
  );
  const defaultBasePath = process.env.STREAMING_CENTER_M3U_BASE_PATH || "";
  const m3uText = buildM3u(body.tracks, body.basePath || defaultBasePath);
  const m3uBlob = body.useWindows1251
    ? new Blob([new Uint8Array(iconv.encode(m3uText, "windows-1251"))], {
        type: "audio/x-mpegurl",
      })
    : new Blob([m3uText], { type: "audio/x-mpegurl" });
  form.append("m3u", m3uBlob, `${safeName}.m3u`);

  const uploadUrl = `${base}/api/v2/playlists/`;
  const timeoutMs = Math.max(
    3000,
    Number.parseInt(
      process.env.STREAMING_CENTER_UPLOAD_TIMEOUT_MS || "15000",
      10,
    ) || 15000,
  );
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "SC-API-KEY": apiKey },
      body: form,
      signal: abort.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeoutHint =
      message.includes("aborted") || message.toLowerCase().includes("timeout")
        ? `Timeout after ${timeoutMs}ms`
        : message;
    return {
      status: 502,
      json: {
        error:
          `Не удалось подключиться к Streaming.Center (${uploadUrl}). ` +
          `Проверьте STREAMING_CENTER_API_URL, доступность сервера и TLS. ` +
          `Детали: ${timeoutHint}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  const data =
    contentType.includes("application/json") && text ? JSON.parse(text) : text;

  if (!res.ok) {
    const messageFromBody =
      typeof data === "string" && data
        ? data
        : (data as { detail?: string; error?: string })?.detail ||
          (data as { detail?: string; error?: string })?.error ||
          "";
    const message =
      messageFromBody ||
      `Streaming.Center error: ${res.status} ${res.statusText}`;
    return { status: 502, json: { error: message } };
  }

  return { status: 200, json: { ok: true, playlist: data } };
}
