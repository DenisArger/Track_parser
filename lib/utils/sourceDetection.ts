/**
 * Автоматическое определение типа источника по URL
 */
export function detectSourceFromUrl(
  url: string
): "youtube" | "youtube-music" {
  if (url.includes("music.youtube.com")) {
    return "youtube-music";
  }
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  }
  // По умолчанию считаем YouTube
  return "youtube";
}
