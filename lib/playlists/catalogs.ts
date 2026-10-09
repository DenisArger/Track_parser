/**
 * Декларативная конфигурация рубрик (каталогов).
 *
 * Это и есть «универсальный механизм»: движок (playlistBuilder) один,
 * а каждая рубрика описывается здесь одним объектом. Чтобы добавить
 * шестую рубрику — достаточно добавить одну запись в массив CATALOGS.
 */

export interface CatalogProfile {
  /** Стабильный внутренний ключ (для отчётов). */
  id: string;
  /** Человекочитаемое имя рубрики — используется в имени .m3u и канонических названиях. */
  rubric: string;
  /**
   * Шаблон папки каталога относительно корня. Поддерживает плейсхолдеры
   * {MM} (месяц, 2 цифры) и {YYYY} (год). Если папка не найдена точным
   * совпадением, используется matchKeyword для поиска по подстроке.
   */
  folder: string;
  /** Ключевое слово для резервного поиска папки в корне (без учёта регистра). */
  matchKeyword: string;
  /**
   * Префикс/название серии, который убирается из названия трека при
   * формировании канонического имени. Убирается везде, где встретится.
   */
  series?: string;
  /** Убирать ведущий порядковый номер эпизода (напр. "218 " в начале имени). */
  stripEpisodeNumber?: boolean;
  /**
   * Доступные коды для плейлистов этой рубрики (вторая пара цифр в имени).
   * Значение по умолчанию — первое в списке.
   */
  codeOptions?: string[];
  /** Код по умолчанию (если не указан, берётся первый из codeOptions или "01"). */
  defaultCode?: string;
}

export const CATALOGS: CatalogProfile[] = [
  {
    id: "odp",
    rubric: "ODB_Podcast_{MM}_{XX}_59",
    folder: "ODB_Podcast_{MM}",
    matchKeyword: "ODB_Podcast",
    series: "Хлеб Наш Насущный",
    codeOptions: ["01", "07", "13", "18"],
    defaultCode: "01",
  },
  {
    id: "dd",
    rubric: "Доброе Духовное_{MM}_{XX}_59",
    folder: "{MM} Доброе Духовное",
    matchKeyword: "Доброе Духовное",
    series: "ДОБРОЕ ДУХОВНОЕ",
    stripEpisodeNumber: true,
    codeOptions: ["03", "09", "15", "20"],
    defaultCode: "03",
  },
  {
    id: "renner",
    rubric: "Renner_podcast_{MM}_{XX}_59",
    folder: "69 Renner_podcast_{MM}_{YYYY}",
    matchKeyword: "Renner",
    series: "Драгоценные истины",
    codeOptions: ["02", "08", "14", "19"],
    defaultCode: "02",
  },
  {
    id: "simonyan",
    rubric: "Artur Simonyan_{MM}_{XX}_59",
    folder: "90 Artur Simonyan_{MM}",
    matchKeyword: "Artur Simonyan",
    series: "Слово от пастора Артура Симоняна",
    codeOptions: ["04", "10", "16", "21"],
    defaultCode: "04",
  },
  {
    id: "joyce",
    rubric: "Joyce Meyer_podcast_{MM}_{XX}_59",
    folder: "11 Joyce Meyer_podcast_{MM}",
    matchKeyword: "Joyce Meyer",
    series: "Джойс Майер",
    codeOptions: ["00", "06", "12"],
    defaultCode: "00",
  },
];