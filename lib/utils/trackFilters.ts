import { Track, TrackStatus } from "@/types/track";

/**
 * Фильтрует треки по статусу
 */
export function filterTracksByStatus(
  tracks: Track[],
  status: TrackStatus
): Track[] {
  return tracks.filter((track) => track.status === status);
}

/**
 * Фильтрует треки по нескольким статусам
 */
export function filterTracksByStatuses(
  tracks: Track[],
  statuses: TrackStatus[]
): Track[] {
  return tracks.filter((track) => statuses.includes(track.status));
}

/**
 * Получает треки для прослушивания (downloaded)
 */
export function getDownloadedTracks(tracks: Track[]): Track[] {
  return filterTracksByStatus(tracks, "downloaded");
}

/**
 * Получает обработанные треки (processed, trimmed, uploaded)
 * Включает uploaded треки для возможности повторной обработки
 */
export function getProcessedTracks(tracks: Track[]): Track[] {
  return filterTracksByStatuses(tracks, ["processed", "trimmed", "uploaded"]);
}

/**
 * Получает загруженные треки (uploaded)
 */
export function getUploadedTracks(tracks: Track[]): Track[] {
  return filterTracksByStatus(tracks, "uploaded");
}

/**
 * Получает треки в процессе скачивания (downloading)
 */
export function getDownloadingTracks(tracks: Track[]): Track[] {
  return filterTracksByStatus(tracks, "downloading");
}

