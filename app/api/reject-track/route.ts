import { NextRequest } from "next/server";
import { rejectTrack } from "@/lib/processTracks";
import { handleApiError, handleValidationError } from "@/lib/api/errorHandler";
import { createSuccessResponse } from "@/lib/api/responseHelpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId } = body;

    if (!trackId) {
      return handleValidationError("Track ID is required");
    }

    await rejectTrack(trackId);
    return createSuccessResponse(undefined, "Track rejected successfully");
  } catch (error) {
    return handleApiError(error, "Failed to reject track");
  }
}
