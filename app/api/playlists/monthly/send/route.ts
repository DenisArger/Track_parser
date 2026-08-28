import { NextRequest, NextResponse } from "next/server";
import {
  uploadPlaylistToStreamingCenter,
  StreamingCenterTrack,
} from "@/lib/radio/uploadPlaylistToStreamingCenter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    playlistId?: string;
    name?: string;
    tracks?: StreamingCenterTrack[];
    serverId?: number;
    isRandom?: boolean;
    basePath?: string;
    useWindows1251?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const { playlistId, name, tracks, serverId, isRandom, basePath, useWindows1251 } = body;

  if (!playlistId || !name || !tracks || tracks.length === 0) {
    return NextResponse.json(
      { error: "Не указаны playlistId, name или tracks" },
      { status: 400 },
    );
  }

  try {
    const res = await uploadPlaylistToStreamingCenter({
      name,
      serverId,
      isRandom,
      basePath,
      useWindows1251,
      tracks,
    });
    if (res.status !== 200)
      throw new Error((res.json as { error?: string })?.error || `HTTP ${res.status}`);
    return NextResponse.json({ success: true, playlistId, name, tracks: tracks.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, playlistId, error: message }, { status: 500 });
  }
}
