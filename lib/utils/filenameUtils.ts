/**
 * Генерирует безопасное имя файла из метаданных трека
 * Формат: "Artist - Title.mp3"
 */
export function generateSafeFilename(metadata: {
  title?: string;
  artist?: string;
}): string {
  // Создаем имя файла в формате "Artist - Title"
  let filename = "";

  // Сначала добавляем артиста
  if (metadata.artist && metadata.artist !== "Unknown") {
    filename = metadata.artist.trim();
  }

  // Затем добавляем тире и название
  if (metadata.title) {
    const title = metadata.title.trim();
    if (title) {
      if (filename) {
        filename += " - " + title;
      } else {
        filename = title;
      }
    }
  }

  // Если нет ни title, ни artist, используем "Unknown"
  if (!filename || filename.trim() === "") {
    filename = "Unknown";
  }

  // Очищаем имя файла от недопустимых символов для файловой системы
  // Заменяем недопустимые символы на пробелы
  filename = filename
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ") // Заменяем недопустимые символы на пробелы
    .replace(/\s+/g, " ") // Множественные пробелы заменяем на один
    .trim();

  // Ограничиваем длину имени файла (оставляем место для расширения)
  if (filename.length > 200) {
    filename = filename.substring(0, 200).trim();
  }

  // Если после очистки имя пустое, используем "Unknown"
  if (!filename || filename === "") {
    filename = "Unknown";
  }

  // Добавляем расширение
  return `${filename}.mp3`;
}

/**
 * Нормализует имя для сопоставления: lowercase, trim, без .mp3
 */
export function normalizeForMatch(s: string): string {
  return (s || "").replace(/\.mp3$/i, "").toLowerCase().trim();
}

/**
 * Парсит "Artist - Title" из raw_name. Если разделителя нет, считает всё названием.
 */
export function parseArtistTitleFromRawName(rawName: string): {
  artist: string | null;
  title: string | null;
} {
  const cleaned = (rawName || "")
    .replace(/\.mp3$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return { artist: null, title: null };

  const sep = " - ";
  const idx = cleaned.indexOf(sep);
  if (idx === -1) {
    return { artist: null, title: cleaned };
  }

  const artist = cleaned.slice(0, idx).trim();
  const title = cleaned.slice(idx + sep.length).trim();

  return {
    artist: artist || null,
    title: title || null,
  };
}
