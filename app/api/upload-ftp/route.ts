import { NextRequest } from "next/server";
import { uploadToFtp } from "@/lib/processTracks";
import { UploadRequest } from "@/types/track";
import { handleApiError, handleValidationError } from "@/lib/api/errorHandler";
import { createSuccessResponse } from "@/lib/api/responseHelpers";

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const { trackId, ftpConfig } = body;

    if (!trackId || !ftpConfig) {
      return handleValidationError("Track ID and FTP config are required");
    }

    await uploadToFtp(trackId, ftpConfig);
    return createSuccessResponse(undefined, "Track uploaded successfully");
  } catch (error) {
    return handleApiError(error, "FTP upload failed");
  }
}
