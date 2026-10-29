import { NextRequest, NextResponse } from "next/server";
import { FtpConfig } from "@/types/track";
import { buildCatalogsOverFtp } from "@/lib/playlists/ftpSource";
import { serializeM3U, resolveRubric } from "@/lib/playlists/playlistBuilder";
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
    day?: number;
    includePrevMonthDays?: number;
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
    day,
    includePrevMonthDays,
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
  const dayNum = Number(day ?? 1);
  const prevDaysNum = Number(includePrevMonthDays ?? 0);
  if (
    !Number.isInteger(monthNum) ||
    monthNum < 1 ||
    monthNum > 12 ||
    !Number.isInteger(yearNum) ||
    !Number.isInteger(dayNum) ||
    dayNum < 1 ||
    dayNum > 31 ||
    !Number.isInteger(prevDaysNum) ||
    prevDaysNum < 0 ||
    prevDaysNum > 31
  ) {
    return NextResponse.json(
      { error: "month должен быть 1-12, day — 1-31, year — числом" },
      { status: 400 },
    );
  }

  const target = { month: monthNum, year: yearNum, day: dayNum, includePrevMonthDays: prevDaysNum };

  try {
    const results = await buildCatalogsOverFtp(ftpConfig, target);

    if (action === "preview") {
      const playlists = results.map((r) => ({
        id: r.profile.id,
        rubric: resolveRubric(r.profile, target),
        rubricTemplate: r.profile.rubric,
        codeOptions: r.profile.codeOptions,
        defaultCode: r.profile.defaultCode,
        folder: r.folder,
        tracks: r.entries.length,
        entries: r.entries.map((e) => ({
          day: e.day,
          title: e.title,
          dateYmd: e.dateYmd,
          originalPath: e.originalPath,
        })),
        unmatched: r.unmatched,
        otherMonths: r.otherMonths,
        m3u: serializeM3U(r.entries, { relative }),
        fileName: `${safeName(resolveRubric(r.profile, target))}.m3u`,
      }));
      return NextResponse.json({ success: true, target: { month: monthNum, year: yearNum, day: dayNum }, playlists });
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
      const rubricName = resolveRubric(r.profile, target);
      const fileName = `${safeName(rubricName)}.m3u`;
      const folderName = r.folder?.split("/").pop() || "";
      const tracks: StreamingCenterTrack[] = r.entries.map((e) => ({
        raw_name: folderName ? `${folderName}/${e.originalName}` : e.originalName,
        artist: "",
        title: e.title,
      }));
      console.log("[MonthlyRubrics] Sending rubric:", rubricName, "tracks:", tracks.length, "folder:", folderName);
      console.log("[MonthlyRubrics] First track raw_name:", tracks[0]?.raw_name);
      try {
        const res = await uploadPlaylistToStreamingCenter({
          name: rubricName,
          serverId,
          isRandom,
          basePath,
          useWindows1251,
          tracks,
        });
        if (res.status !== 200)
          throw new Error((res.json as { error?: string })?.error || `HTTP ${res.status}`);
        sent.push({ rubric: rubricName, fileName, tracks: r.entries.length, ok: true });
      } catch (e) {
        sent.push({
          rubric: rubricName,
          fileName,
          tracks: r.entries.length,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return NextResponse.json({ success: true, target: { month: monthNum, year: yearNum, day: dayNum }, sent });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Ошибка построения плейлистов: ${message}` },
      { status: 500 },
    );
  }
}