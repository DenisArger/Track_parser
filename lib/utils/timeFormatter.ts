/**
 * Форматирует время в секундах в формат MM:SS
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Форматирует длительность трека в секундах в формат MM:SS
 */
export function formatDuration(duration?: number): string {
  if (!duration) {
    return "Unknown";
  }
  return formatTime(duration);
}
