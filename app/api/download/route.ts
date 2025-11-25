import { NextRequest } from "next/server";
import { downloadTrack } from "@/lib/processTracks";
import { DownloadRequest } from "@/types/track";
import { handleApiError, handleValidationError } from "@/lib/api/errorHandler";
import { createTrackResponse } from "@/lib/api/responseHelpers";

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
      return handleValidationError("URL is required");
    }

    // Если source не указан, определяем автоматически
    const detectedSource = source || detectSourceFromUrl(url);

    const track = await downloadTrack(url, detectedSource);
    return createTrackResponse(track, "Download started successfully");
  } catch (error) {
    return handleApiError(error, "Download failed");
  }
}
