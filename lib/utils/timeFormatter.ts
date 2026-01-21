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

/**
 * Форматирует время в секундах в формат M:SS.ms (с десятыми/сотыми долями)
 * Пример: 70.25 → "1:10.25"
 */
export function formatTimeMs(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return "0:00.00";
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const frac = Math.round((secs - whole) * 100);
  const fracStr = frac.toString().padStart(2, "0");
  return `${minutes}:${whole.toString().padStart(2, "0")}.${fracStr}`;
}

/**
 * Парсит строку времени в формате M:SS, M:SS.s или M:SS.ss в секунды.
 * При ошибке возвращает fallback или 0.
 */
export function parseTimeMs(str: string, fallback: number = 0): number {
  if (typeof str !== "string" || !str.trim()) return fallback;
  const s = str.trim();
  const m = /^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return fallback;
  const minutes = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  const frac = m[3] != null ? parseInt(m[3].padEnd(2, "0"), 10) : 0;
  if (secs > 59 || frac > 99) return fallback;
  const total = minutes * 60 + secs + frac / 100;
  return isFinite(total) && total >= 0 ? total : fallback;
}
