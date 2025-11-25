import { NextRequest } from "next/server";
import { downloadTrack } from "@/lib/processTracks";
import { DownloadRequest } from "@/types/track";
import { handleApiError, handleValidationError } from "@/lib/api/errorHandler";
import { createTrackResponse } from "@/lib/api/responseHelpers";

export async function POST(request: NextRequest) {
  try {
    const body: DownloadRequest = await request.json();
    const { url, source } = body;

    if (!url || !source) {
      return handleValidationError("URL and source are required");
    }

    const track = await downloadTrack(url, source);
    return createTrackResponse(track, "Download started successfully");
  } catch (error) {
    return handleApiError(error, "Download failed");
  }
}
