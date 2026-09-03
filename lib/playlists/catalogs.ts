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
}

export const CATALOGS: CatalogProfile[] = [
  {
    id: "odp",
    rubric: "ODB_Podcast_{MM}_01_59",
    folder: "ODB_Podcast_{MM}",
    matchKeyword: "ODB_Podcast",
    series: "Хлеб Наш Насущный",
  },
  {
    id: "dd",
    rubric: "Доброе Духовное_{MM}_03_59",
    folder: "{MM} Доброе Духовное",
    matchKeyword: "Доброе Духовное",
    series: "ДОБРОЕ ДУХОВНОЕ",
    stripEpisodeNumber: true,
  },
  {
    id: "renner",
    rubric: "Renner_podcast_{MM}_02_59",
    folder: "69 Renner_podcast_{MM}_{YYYY}",
    matchKeyword: "Renner",
    series: "Драгоценные истины",
  },
  {
    id: "simonyan",
    rubric: "Artur Simonyan_{MM}_04_59",
    folder: "90 Artur Simonyan_{MM}",
    matchKeyword: "Artur Simonyan",
    series: "Слово от пастора Артура Симоняна",
  },
  {
    id: "joyce",
    rubric: "Joyce Meyer_podcast_{MM}_00_59",
    folder: "11 Joyce Meyer_podcast_{MM}",
    matchKeyword: "Joyce Meyer",
    series: "Джойс Майер",
  },
];
