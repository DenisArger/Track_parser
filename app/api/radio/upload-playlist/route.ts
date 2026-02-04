import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { generateSafeFilename } from "@/lib/utils/filenameUtils";
import iconv from "iconv-lite";

export const runtime = "nodejs";

const ADMIN_EMAIL = "den.arger@gmail.com";

type UploadTrack = {
  raw_name?: string | null;
  artist?: string | null;
  title?: string | null;
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

function joinBasePath(basePath: string, filename: string): string {
  const trimmedBase = (basePath || "").trim();
  if (!trimmedBase) return filename;
  const normalizedBase = trimmedBase.replace(/[\\/]+$/, "");
  const sep = normalizedBase.includes("\\") ? "\\" : "/";
  return `${normalizedBase}${sep}${filename}`;
}

function buildM3u(tracks: UploadTrack[], basePath: string): string {
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
    const value =
      basePath
        ? joinBasePath(basePath, filename || raw)
        : hasPath
          ? raw
          : filename;
    if (value) lines.push(value);
  }
  return lines.join("\r\n");
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = (user.email || "").toLowerCase();
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      name?: string;
      serverId?: number;
      isRandom?: boolean;
      basePath?: string;
      useWindows1251?: boolean;
      tracks?: UploadTrack[];
    };

    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Название плейлиста обязательно" },
        { status: 400 }
      );
    }

    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "Нет треков для загрузки" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
    const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        {
          error:
            "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы",
        },
        { status: 500 }
      );
    }

    const base = normalizeApiBase(apiUrl);
    const safeName =
      name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "playlist";

    const form = new FormData();
    form.append("name", name);
    form.append("is_random", body.isRandom ? "True" : "False");
    form.append(
      "server",
      String(Number.isFinite(body.serverId) ? body.serverId : 1)
    );
    const defaultBasePath = process.env.STREAMING_CENTER_M3U_BASE_PATH || "";
    const m3uText = buildM3u(tracks, body.basePath || defaultBasePath);
    const m3uBlob = body.useWindows1251
      ? new Blob([new Uint8Array(iconv.encode(m3uText, "windows-1251"))], {
          type: "audio/x-mpegurl",
        })
      : new Blob([m3uText], { type: "audio/x-mpegurl" });
    form.append("m3u", m3uBlob, `${safeName}.m3u`);

    const res = await fetch(`${base}/api/v2/playlists/`, {
      method: "POST",
      headers: {
        "SC-API-KEY": apiKey,
      },
      body: form,
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    const data =
      contentType.includes("application/json") && text
        ? JSON.parse(text)
        : text;

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
      console.error("[radio upload] streaming.center error", {
        status: res.status,
        statusText: res.statusText,
        contentType,
        body: messageFromBody || text,
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, playlist: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
