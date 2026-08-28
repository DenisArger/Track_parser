import { describe, it, expect } from "vitest";
import {
  parseDateFromName,
  formatDateYMD,
  extractYearFromFolder,
} from "./dateParser";

describe("parseDateFromName", () => {
  it("парсит числовой формат DD-MM-YYYY (ODB)", () => {
    const d = parseDateFromName("Хлеб Наш Насущный - Сегодняшнее чтение 01-09-2026");
    expect(d).not.toBeNull();
    expect(d!.day).toBe(1);
    expect(d!.month).toBe(9);
    expect(d!.year).toBe(2026);
    expect(d!.raw).toBe("01-09-2026");
  });

  it("парсит русский родительный месяц без года (Доброе Духовное)", () => {
    const d = parseDateFromName("218 БОЛЬШЕ НЕ КРАДИ - ДОБРОЕ ДУХОВНОЕ - 1 августа", {
      defaultYear: 2026,
    });
    expect(d).not.toBeNull();
    expect(d!.day).toBe(1);
    expect(d!.month).toBe(8);
    expect(d!.year).toBe(2026);
    expect(d!.raw).toBe("1 августа");
  });

  it("парсит русский месяц в скобках (Renner)", () => {
    const d = parseDateFromName(
      "Драгоценные истины - Что мы должны искать прежде всего (1 сентября)",
      { defaultYear: 2019 },
    );
    expect(d).not.toBeNull();
    expect(d!.day).toBe(1);
    expect(d!.month).toBe(9);
    expect(d!.year).toBe(2019);
  });

  it("парсит русский месяц после тире (Симонян)", () => {
    const d = parseDateFromName(
      "Слово от пастора Артура Симоняна - 1 сентября",
      { defaultYear: 2026 },
    );
    expect(d).not.toBeNull();
    expect(d!.day).toBe(1);
    expect(d!.month).toBe(9);
  });

  it("парсит русский месяц (Joyce Meyer)", () => {
    const d = parseDateFromName(
      "Джойс Майер - Слушайте Бога каждое утро - 1 сентября",
      { defaultYear: 2026 },
    );
    expect(d).not.toBeNull();
    expect(d!.day).toBe(1);
    expect(d!.month).toBe(9);
  });

  it("возвращает null, если даты нет", () => {
    expect(parseDateFromName("Просто название без даты")).toBeNull();
  });

  it("formatDateYMD форматирует в YYYY-MM-DD", () => {
    const d = parseDateFromName("1 сентября", { defaultYear: 2026 })!;
    expect(formatDateYMD(d)).toBe("2026-09-01");
  });
});

describe("extractYearFromFolder", () => {
  it("извлекает год из имени папки", () => {
    expect(extractYearFromFolder("69 Renner_podcast_09_2019")).toBe(2019);
    expect(extractYearFromFolder("ODB_Podcast_09")).toBeNull();
  });
});
