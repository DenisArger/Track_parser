import { NextRequest, NextResponse } from "next/server";
import { downloadTrack } from "@/lib/processTracks";
import { DownloadRequest } from "@/types/track";

// Автоматическое определение типа источника по URL
function detectSourceFromUrl(
  url: string
): "youtube" | "youtube-music" | "yandex" {
  if (url.includes("music.youtube.com")) {
    return "youtube-music";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  } else if (url.includes("music.yandex.ru")) {
    return "yandex";
  } else {
    // По умолчанию считаем YouTube
    return "youtube";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequest = await request.json();
    const { url, source } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Если source не указан, определяем автоматически
    const detectedSource = source || detectSourceFromUrl(url);

    const track = await downloadTrack(url, detectedSource);

    return NextResponse.json({
      success: true,
      track,
      message: "Download started successfully",
      detectedSource,
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Download failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
