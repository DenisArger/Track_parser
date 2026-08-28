import { NextRequest, NextResponse } from "next/server";
import { FtpConfig } from "@/types/track";
import { buildCatalogsOverFtp } from "@/lib/playlists/ftpSource";
import { serializeM3U } from "@/lib/playlists/playlistBuilder";
import {
  uploadPlaylistToStreamingCenter,
  StreamingCenterTrack,
} from "@/lib/radio/uploadPlaylistToStreamingCenter";

export const runtime = "nodejs";

function safeName(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  let body: {
    ftpConfig?: FtpConfig;
    month?: number;
    year?: number;
    action?: "preview" | "send";
    relative?: boolean;
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

  const {
    ftpConfig,
    month,
    year,
    action = "preview",
    relative,
    serverId,
    isRandom,
    basePath,
    useWindows1251,
  } = body;

  if (!ftpConfig || !ftpConfig.host || !ftpConfig.user) {
    return NextResponse.json(
      { error: "Не указаны FTP-данные (host/user)" },
      { status: 400 },
    );
  }
  const monthNum = Number(month);
  const yearNum = Number(year);
  if (
    !Number.isInteger(monthNum) ||
    monthNum < 1 ||
    monthNum > 12 ||
    !Number.isInteger(yearNum)
  ) {
    return NextResponse.json(
      { error: "month должен быть 1-12, year — числом" },
      { status: 400 },
    );
  }

  const target = { month: monthNum, year: yearNum };

  try {
    const results = await buildCatalogsOverFtp(ftpConfig, target);

    if (action === "preview") {
      const playlists = results.map((r) => ({
        id: r.profile.id,
        rubric: r.profile.rubric,
        folder: r.folder,
        tracks: r.entries.length,
        entries: r.entries.map((e) => ({
          day: e.day,
          title: e.title,
          dateYmd: e.dateYmd,
        })),
        unmatched: r.unmatched,
        otherMonths: r.otherMonths,
        m3u: serializeM3U(r.entries, { relative }),
        fileName: `${safeName(r.profile.rubric)}.m3u`,
      }));
      return NextResponse.json({ success: true, target: { month: monthNum, year: yearNum }, playlists });
    }

    // action === "send": отправляем каждую рубрику в Streaming.Center
    // по аналогии с вкладкой «Плейлист» (по одному плейлисту на рубрику).
    const sent: {
      rubric: string;
      fileName: string;
      tracks: number;
      ok: boolean;
      error?: string;
    }[] = [];
    for (const r of results) {
      const fileName = `${safeName(r.profile.rubric)}.m3u`;
      const tracks: StreamingCenterTrack[] = r.entries.map((e) => ({
        raw_name: e.originalPath,
        artist: r.profile.rubric,
        title: e.title,
      }));
      try {
        const res = await uploadPlaylistToStreamingCenter({
          name: r.profile.rubric,
          serverId,
          isRandom,
          basePath,
          useWindows1251,
          tracks,
        });
        if (res.status !== 200)
          throw new Error((res.json as { error?: string })?.error || `HTTP ${res.status}`);
        sent.push({ rubric: r.profile.rubric, fileName, tracks: r.entries.length, ok: true });
      } catch (e) {
        sent.push({
          rubric: r.profile.rubric,
          fileName,
          tracks: r.entries.length,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return NextResponse.json({ success: true, target: { month: monthNum, year: yearNum }, sent });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Ошибка построения плейлистов: ${message}` },
      { status: 500 },
    );
  }
}
