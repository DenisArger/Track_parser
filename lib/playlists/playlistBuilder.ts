/**
 * Движок формирования месячных плейлистов.
 *
 * Для заданного корня и целевого месяца/года: находит папку каждой рубрики,
 * парсит дату из каждого трека, оставляет только треки целевого месяца,
 * сортирует по дню и возвращает записи с каноническими названиями.
 */

import fs from "fs-extra";
import path from "path";
import {
  extractYearFromFolder,
  formatDateYMD,
  parseDateFromName,
  ParsedDate,
} from "./dateParser";
import { CATALOGS, CatalogProfile } from "./catalogs";

export interface TargetMonth {
  month: number; // 1-12
  year: number;
}

export interface PlaylistEntry {
  day: number;
  date: ParsedDate;
  dateYmd: string;
  /** Очищенное каноническое название эпизода (сохраняет «сегодняшнее наименование»). */
  title: string;
  /** Полное каноническое имя для переименования файла: YYYY-MM-DD Rubric — Title. */
  canonicalName: string;
  originalPath: string;
  originalName: string;
}

export interface CatalogResult {
  profile: CatalogProfile;
  folder: string | null;
  entries: PlaylistEntry[];
  /** Треки в папке, из имён которых не удалось извлечь дату. */
  unmatched: string[];
  /** Треки не целевого месяца (проигнорированы, не попали в плейлист). */
  otherMonths: number;
}

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Находит имя папки каталога среди списка директорий.
 * Порядок: точное совпадение шаблона -> шаблон без года -> поиск по ключевому слову.
 * «Без года» нужен, т.к. Renner-шаблон содержит {YYYY}, а папка может быть
 * названа без года (69 Renner_podcast_09).
 */
export function resolveCatalogFolderName(
  dirs: string[],
  profile: CatalogProfile,
  target: TargetMonth,
): string | null {
  const mm = String(target.month).padStart(2, "0");
  const filled = profile.folder.replace("{MM}", mm).replace("{YYYY}", String(target.year));
  if (dirs.includes(filled)) return filled;

  const filledNoYear = profile.folder
    .replace("{MM}", mm)
    .replace(/[_-]?\s*\{YYYY\}/, "")
    .replace(/_+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (filledNoYear && dirs.includes(filledNoYear)) return filledNoYear;

  const kw = profile.matchKeyword.toLowerCase();
  return dirs.find((n) => n.toLowerCase().includes(kw)) ?? null;
}

function resolveFolder(
  root: string,
  profile: CatalogProfile,
  target: TargetMonth,
): string | null {
  const filled = profile.folder
    .replace("{MM}", String(target.month).padStart(2, "0"))
    .replace("{YYYY}", String(target.year));
  const exact = path.join(root, filled);
  if (fs.existsSync(exact)) return exact;

  if (!fs.existsSync(root)) return null;
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const hit = resolveCatalogFolderName(dirs, profile, target);
  return hit ? path.join(root, hit) : null;
}

export function resolveRubric(profile: CatalogProfile, target: TargetMonth): string {
  return profile.rubric
    .replace("{MM}", String(target.month).padStart(2, "0"))
    .replace("{YYYY}", String(target.year));
}

function extractTitle(
  rawName: string,
  date: ParsedDate,
  profile: CatalogProfile,
): string {
  let s = rawName.replace(/\.[^.]+$/, "");
  s = s.replace(date.raw, " ");
  s = s.replace(/[()]/g, " ");
  if (profile.stripEpisodeNumber) {
    s = s.replace(/^\s*\d+\s*[-–—]?\s*/, "");
  }
  if (profile.series) {
    s = s.replace(new RegExp(escapeRegExp(profile.series), "gi"), " ");
  }
  // Убираем «шумные» остатки разделителей после очистки префиксов/серий.
  s = s.replace(/^\s*[-–—]\s*/, ""); // ведущий разделитель
  s = s.replace(/\s+[-–—]\s+/g, " "); // внутренний разделитель -> пробел
  s = s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[-–—]\s*$/, "") // хвостовой разделитель
    .trim();
  if (!s && profile.series) s = profile.series.trim();
  return s;
}

/**
 * Чистый сборщик: работает только со списком имён файлов, без обращения к ФС.
 * Используется и локально (имена из readdir), и по FTP (имена из list()).
 */
export function buildCatalogPlaylistFromFiles(
  files: string[],
  folderLabel: string | null,
  profile: CatalogProfile,
  target: TargetMonth,
  pathResolver?: (name: string) => string,
): CatalogResult {
  const entries: PlaylistEntry[] = [];
  const unmatched: string[] = [];
  let otherMonths = 0;

  const folderYear = folderLabel ? extractYearFromFolder(folderLabel) : null;
  const year = folderYear ?? target.year;

  for (const f of files) {
    const date = parseDateFromName(f, { defaultYear: year });
    if (!date) {
      unmatched.push(f);
      continue;
    }
    if (date.month !== target.month) {
      otherMonths += 1;
      continue;
    }
    const title = extractTitle(f, date, profile);
    const dateYmd = formatDateYMD(date);
    entries.push({
      day: date.day,
      date,
      dateYmd,
      title,
      canonicalName: `${dateYmd} ${resolveRubric(profile, target)} — ${title}`,
      originalPath: pathResolver ? pathResolver(f) : f,
      originalName: f,
    });
  }

  entries.sort((a, b) => a.day - b.day);
  return { profile, folder: folderLabel, entries, unmatched, otherMonths };
}

export function buildCatalogPlaylist(
  root: string,
  profile: CatalogProfile,
  target: TargetMonth,
): CatalogResult {
  const folder = resolveFolder(root, profile, target);
  if (!folder) {
    return { profile, folder: null, entries: [], unmatched: [], otherMonths: 0 };
  }

  const files = fs.readdirSync(folder).filter((f) => AUDIO_EXT.test(f));
  return buildCatalogPlaylistFromFiles(
    files,
    folder,
    profile,
    target,
    (f) => path.join(folder, f),
  );
}

export function buildAllPlaylists(
  root: string,
  target: TargetMonth,
  profiles: CatalogProfile[] = [],
): CatalogResult[] {
  const list = profiles.length ? profiles : CATALOGS;
  return list.map((p) => buildCatalogPlaylist(root, p, target));
}

export function serializeM3U(
  entries: PlaylistEntry[],
  opts: { relative?: boolean; baseDir?: string } = {},
): string {
  const lines: string[] = ["#EXTM3U"];
  for (const e of entries) {
    lines.push(`#EXTINF:-1,${e.title}`);
    const p =
      opts.relative && opts.baseDir
        ? path.relative(opts.baseDir, e.originalPath)
        : e.originalPath;
    lines.push(p);
  }
  return lines.join("\n") + "\n";
}

export function writeM3U(
  entries: PlaylistEntry[],
  outPath: string,
  opts: { relative?: boolean } = {},
): void {
  const text = serializeM3U(entries, { relative: opts.relative, baseDir: path.dirname(outPath) });
  fs.ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, text, "utf8");
}
