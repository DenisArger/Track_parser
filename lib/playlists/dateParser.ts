/**
 * Универсальный парсер дат из имён треков.
 *
 * Поддерживает два стиля, встречающихся в каталогах:
 *  - числовой:  "01-09-2026"  (DD-MM-YYYY / DD.MM.YYYY)
 *  - русский родительный падеж месяца: "1 сентября", "1 августа"
 *
 * Год разрешается в порядке: год из имени (числовой формат) >
 * год из имени папки (напр. _2019) > целевой год.
 */

export interface ParsedDate {
  day: number;
  month: number;
  year: number;
  /** Точный фрагмент имени, совпавший с датой (нужен для очистки названия). */
  raw: string;
}

const RU_MONTHS: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
};

const RU_MONTH_PATTERN = Object.keys(RU_MONTHS).join("|");
// Без \b: в JS \b — ASCII-граница, она не работает с кириллицей.
const RU_MONTH_REGEX = new RegExp(
  `(?<![0-9])(\\d{1,2})\\s+(${RU_MONTH_PATTERN})(?![а-яёА-ЯЁ])`,
  "i",
);
const NUMERIC_REGEX =
  /(?<![0-9])(\d{1,2})[-.](\d{1,2})(?:[-.](\d{2,4}))?(?![0-9])/;
const FOLDER_YEAR_REGEX = /(?:^|[^0-9])((?:19|20)\d{2})(?![0-9])/;

function isValidDM(day: number, month: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function normalizeYear(value: string): number {
  const n = parseInt(value, 10);
  if (value.length <= 2) return 2000 + n;
  return n;
}

export function extractYearFromFolder(folderName: string): number | null {
  const m = folderName.match(FOLDER_YEAR_REGEX);
  return m ? parseInt(m[1], 10) : null;
}

export function parseDateFromName(
  name: string,
  opts: { defaultYear?: number } = {},
): ParsedDate | null {
  const fallbackYear = opts.defaultYear ?? new Date().getFullYear();

  const numeric = name.match(NUMERIC_REGEX);
  if (numeric) {
    const day = parseInt(numeric[1], 10);
    const month = parseInt(numeric[2], 10);
    const year = numeric[3]
      ? normalizeYear(numeric[3])
      : fallbackYear;
    if (isValidDM(day, month)) {
      return { day, month, year, raw: numeric[0] };
    }
  }

  const ru = name.match(RU_MONTH_REGEX);
  if (ru) {
    const day = parseInt(ru[1], 10);
    const month = RU_MONTHS[ru[2].toLowerCase()];
    const year = fallbackYear;
    if (isValidDM(day, month)) {
      return { day, month, year, raw: ru[0] };
    }
  }

  return null;
}

export function formatDateYMD(d: ParsedDate): string {
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}
