import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";

export const runtime = "nodejs";

type PlaylistRow = {
  id?: number | null;
  name?: string | null;
  created_at?: string | null;
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

function buildAuthHeaders(apiKey: string, authToken?: string): HeadersInit {
  const headers: Record<string, string> = { "SC-API-KEY": apiKey };
  if (authToken && authToken.trim()) {
    headers.Authorization = `Token ${authToken.trim()}`;
  }
  return headers;
}

function unwrapPlaylists(data: unknown): PlaylistRow[] {
  if (Array.isArray(data)) return data as PlaylistRow[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const arr = obj.results ?? obj.data ?? obj.items ?? obj.playlists;
  return Array.isArray(arr) ? (arr as PlaylistRow[]) : [];
}

function friendlyStreamingCenterMessage(message: string): string {
  const normalized = message.trim();
  if (!normalized) return normalized;
  if (normalized.toLowerCase().includes("authentication credentials were not provided")) {
    return (
      "Streaming.Center требует авторизацию для списка плейлистов. " +
      "Добавьте STREAMING_CENTER_AUTH_TOKEN, полученный через POST /api/v1/rest-auth/login/ " +
      "в админке Streaming.Center, и используйте его как Authorization: Token <key>."
    );
  }
  return normalized;
}

function sortPlaylists(rows: PlaylistRow[]): PlaylistRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : NaN;
    const bTime = b.created_at ? Date.parse(b.created_at) : NaN;
    const aHasTime = Number.isFinite(aTime);
    const bHasTime = Number.isFinite(bTime);
    if (aHasTime && bHasTime && aTime !== bTime) return bTime - aTime;
    if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
    const aId = typeof a.id === "number" ? a.id : Number.NaN;
    const bId = typeof b.id === "number" ? b.id : Number.NaN;
    if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return bId - aId;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
    const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
    const authToken = process.env.STREAMING_CENTER_AUTH_TOKEN || "";
    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы" },
        { status: 500 }
      );
    }

    const base = normalizeApiBase(apiUrl);
    const url = `${base}/api/v2/playlists/`;
    const res = await fetch(url, {
      headers: buildAuthHeaders(apiKey, authToken),
    });
    const text = await res.text();
    let data: unknown = text;
    if (text && (text.startsWith("{") || text.startsWith("["))) {
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Streaming.Center вернул невалидный JSON" }, { status: 502 });
      }
    }

    if (!res.ok) {
      const message =
        (data as { detail?: string; error?: string })?.detail ||
        (data as { detail?: string; error?: string })?.error ||
        `Streaming.Center error: ${res.status} ${res.statusText}`;
      return NextResponse.json({ error: friendlyStreamingCenterMessage(message) }, { status: 502 });
    }

    return NextResponse.json({ playlists: sortPlaylists(unwrapPlaylists(data)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
