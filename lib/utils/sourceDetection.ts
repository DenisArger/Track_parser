/**
 * Автоматическое определение типа источника по URL
 */
export function detectSourceFromUrl(
  url: string
): "youtube" | "youtube-music" | "yandex" {
  if (url.includes("music.youtube.com")) {
    return "youtube-music";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  } else if (
    url.includes("music.yandex.ru") ||
    url.includes("music.yandex.com")
  ) {
    return "yandex";
  } else {
    // По умолчанию считаем YouTube
    return "youtube";
  }
}
