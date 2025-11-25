import { NextRequest } from "next/server";
import { processTrack } from "@/lib/processTracks";
import { ProcessingRequest, TrackMetadata } from "@/types/track";
import { handleApiError, handleValidationError } from "@/lib/api/errorHandler";
import { createTrackResponse } from "@/lib/api/responseHelpers";

export async function POST(request: NextRequest) {
  try {
    const body: ProcessingRequest = await request.json();
    const { trackId, metadata, trimSettings } = body;

    console.log("Processing track request:", {
      trackId,
      metadata,
      trimSettings,
    });

    if (!trackId) {
      return handleValidationError("Track ID is required");
    }

    const track = await processTrack(
      trackId,
      metadata as TrackMetadata | undefined,
      trimSettings
    );

    return createTrackResponse(track, "Track processed successfully");
  } catch (error) {
    return handleApiError(error, "Processing failed");
  }
}
