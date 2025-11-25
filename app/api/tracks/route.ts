import { NextResponse } from "next/server";
import { getAllTracks } from "@/lib/processTracks";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET() {
  try {
    const tracks = await getAllTracks();
    return NextResponse.json(tracks);
  } catch (error) {
    return handleApiError(error, "Failed to fetch tracks");
  }
}
