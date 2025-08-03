import { NextRequest, NextResponse } from "next/server";
import {
  getTrack,
  saveTracksToFile,
  writeTrackTags,
} from "@/lib/processTracks";
import { TrackMetadata } from "@/types/track";

// Импортируем Map с треками для обновления
import { tracks } from "@/lib/processTracks";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, metadata } = body;

    if (!trackId || !metadata) {
      console.error("Missing required parameters:", { trackId, metadata });
      return NextResponse.json(
        { error: "Track ID and metadata are required" },
        { status: 400 }
      );
    }

    const track = await getTrack(trackId);
    if (!track) {
      console.error("Track not found for ID:", trackId);
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    console.log("Updating metadata for track:", track.filename);

    // Update track metadata
    Object.assign(track.metadata, metadata);

    // Update track in memory
    tracks.set(trackId, track);

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

    // Save tracks to file to persist changes
    await saveTracksToFile();

    console.log("Metadata updated successfully for track:", track.filename);

    return NextResponse.json({
      success: true,
      track,
      message: "Metadata updated successfully",
    });
  } catch (error) {
    console.error("Metadata update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update metadata",
        success: false,
      },
      { status: 500 }
    );
  }
}
