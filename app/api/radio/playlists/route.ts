import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";

export const runtime = "nodejs";

type PlaylistRow = {
  id?: number | null;
  name?: string | null;
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

function unwrapPlaylists(data: unknown): PlaylistRow[] {
  if (Array.isArray(data)) return data as PlaylistRow[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const arr = obj.results ?? obj.data ?? obj.items ?? obj.playlists;
  return Array.isArray(arr) ? (arr as PlaylistRow[]) : [];
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
    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы" },
        { status: 500 }
      );
    }

    const base = normalizeApiBase(apiUrl);
    const url = `${base}/api/v2/playlists/`;
    const res = await fetch(url, {
      headers: { "SC-API-KEY": apiKey },
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
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ playlists: unwrapPlaylists(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
