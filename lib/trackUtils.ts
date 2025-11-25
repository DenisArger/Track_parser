import fs from "fs-extra";
import path from "path";
import { Track, TrackMetadata } from "@/types/track";

// Функция для проверки, был ли трек действительно обрезан
export function isTrackActuallyTrimmed(metadata: TrackMetadata): boolean {
  if (!metadata.isTrimmed || !metadata.trimSettings) {
    return false;
  }

  const { trimSettings } = metadata;

  // Проверяем, была ли действительно применена обрезка
  return (
    trimSettings.startTime > 0 ||
    trimSettings.endTime !== undefined ||
    trimSettings.fadeIn > 0 ||
    trimSettings.fadeOut > 0 ||
    (trimSettings.maxDuration !== undefined && trimSettings.maxDuration < 360)
  );
}

// Функция для очистки неправильно помеченных треков
export async function cleanupTrackStatuses(): Promise<void> {
  const tracksPath = path.join(process.cwd(), "tracks.json");

  if (!(await fs.pathExists(tracksPath))) {
    console.log("tracks.json not found");
    return;
  }

  const tracksData = await fs.readJson(tracksPath);
  let hasChanges = false;

  for (const track of tracksData) {
    const wasActuallyTrimmed = isTrackActuallyTrimmed(track.metadata);

    if (track.metadata.isTrimmed && !wasActuallyTrimmed) {
      console.log(`Cleaning up track ${track.id}: removing false trim flag`);
      delete track.metadata.isTrimmed;
      delete track.metadata.trimSettings;
      hasChanges = true;
    } else if (!track.metadata.isTrimmed && wasActuallyTrimmed) {
      console.log(`Fixing track ${track.id}: adding missing trim flag`);
      track.metadata.isTrimmed = true;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await fs.writeJson(tracksPath, tracksData, { spaces: 2 });
    console.log("Track statuses cleaned up successfully");
  } else {
    console.log("No track status cleanup needed");
  }
}

// Функция для получения статистики треков
export async function getTrackStats(): Promise<{
  total: number;
  downloaded: number;
  processed: number;
  trimmed: number;
  rejected: number;
}> {
  const tracksPath = path.join(process.cwd(), "tracks.json");

  if (!(await fs.pathExists(tracksPath))) {
    return { total: 0, downloaded: 0, processed: 0, trimmed: 0, rejected: 0 };
  }

  const tracksData = await fs.readJson(tracksPath);

  const stats = {
    total: tracksData.length,
    downloaded: 0,
    processed: 0,
    trimmed: 0,
    rejected: 0,
  };

  for (const track of tracksData) {
    switch (track.status) {
      case "downloaded":
        stats.downloaded++;
        break;
      case "processed":
        stats.processed++;
        break;
      case "rejected":
        stats.rejected++;
        break;
    }

    if (isTrackActuallyTrimmed(track.metadata)) {
      stats.trimmed++;
    }
  }

  return stats;
}
