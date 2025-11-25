import { NextRequest } from "next/server";
import { getTrack } from "@/lib/processTracks";
import { setTrack, saveTracksToFile } from "@/lib/storage/trackStorage";
import { writeTrackTags } from "@/lib/audio/metadataWriter";
import { TrackMetadata } from "@/types/track";
import {
  handleApiError,
  handleValidationError,
  handleNotFoundError,
} from "@/lib/api/errorHandler";
import { createTrackResponse } from "@/lib/api/responseHelpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, metadata } = body;

    if (!trackId || !metadata) {
      return handleValidationError("Track ID and metadata are required");
    }

    const track = await getTrack(trackId);
    if (!track) {
      return handleNotFoundError("Track not found");
    }

    console.log("Updating metadata for track:", track.filename);

    // Update track metadata
    Object.assign(track.metadata, metadata);

    // Write metadata to audio file if processed path exists
    if (track.processedPath) {
      try {
        await writeTrackTags(track.processedPath, track.metadata);
        console.log("Metadata written to audio file:", track.processedPath);
      } catch (error) {
        console.error("Error writing metadata to audio file:", error);
        // Continue execution even if writing to audio file fails
      }
    }

    // Save track to storage and file
    setTrack(trackId, track);
    await saveTracksToFile();

    return createTrackResponse(track, "Metadata updated successfully");
  } catch (error) {
    return handleApiError(error, "Failed to update metadata");
  }
}
