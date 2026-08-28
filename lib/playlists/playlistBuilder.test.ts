import { describe, it, expect, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import {
  buildAllPlaylists,
  buildCatalogPlaylist,
  buildCatalogPlaylistFromFiles,
  resolveCatalogFolderName,
  writeM3U,
  CATALOGS,
} from "./index";

const tmpRoots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "playlists-"));
  tmpRoots.push(root);
  return root;
}

afterEach(() => {
  while (tmpRoots.length) {
    const r = tmpRoots.pop()!;
    if (fs.existsSync(r)) fs.removeSync(r);
  }
});

function profile(id: string) {
  return CATALOGS.find((c) => c.id === id)!;
}

describe("buildCatalogPlaylist", () => {
  it("собирает, чистит названия и сортирует треки целевого месяца", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "ODB_Podcast_09"));
    fs.writeFileSync(
      path.join(root, "ODB_Podcast_09", "Хлеб Наш Насущный - Сегодняшнее чтение 05-09-2026.mp3"),
      "",
    );
    fs.writeFileSync(
      path.join(root, "ODB_Podcast_09", "Хлеб Наш Насущный - Сегодняшнее чтение 01-09-2026.mp3"),
      "",
    );

    const res = buildCatalogPlaylist(root, profile("odp"), {
      month: 9,
      year: 2026,
    });

    expect(res.entries).toHaveLength(2);
    expect(res.entries.map((e) => e.title)).toEqual([
      "Сегодняшнее чтение",
      "Сегодняшнее чтение",
    ]);
    // сортировка по дню
    expect(res.entries[0].day).toBe(1);
    expect(res.entries[1].day).toBe(5);
  });

  it("убирает номер эпизода и рубрику (Доброе Духовное) и фильтрует не тот месяц", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "08 Доброе Духовное"));
    fs.writeFileSync(
      path.join(root, "08 Доброе Духовное", "219 ВЕРА - ДОБРОЕ ДУХОВНОЕ - 2 сентября.mp3"),
      "",
    );
    fs.writeFileSync(
      path.join(root, "08 Доброе Духовное", "218 ЧТО-ТО - ДОБРОЕ ДУХОВНОЕ - 1 августа.mp3"),
      "",
    );

    const res = buildCatalogPlaylist(root, profile("dd"), {
      month: 9,
      year: 2026,
    });

    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].title).toBe("ВЕРА");
    expect(res.otherMonths).toBe(1);
  });

  it("Renner: год из папки (_2019), название без серии", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "69 Renner_podcast_09_2019"));
    fs.writeFileSync(
      path.join(root, "69 Renner_podcast_09_2019", "Драгоценные истины - Что мы должны искать прежде всего (1 сентября).mp3"),
      "",
    );

    const res = buildCatalogPlaylist(root, profile("renner"), {
      month: 9,
      year: 2019,
    });
    expect(res.entries[0].title).toBe("Что мы должны искать прежде всего");
    expect(res.entries[0].date.year).toBe(2019);
  });

  it("Симонян: название = серия, если эпизода нет", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "90 Artur Simonyan_09"));
    fs.writeFileSync(
      path.join(root, "90 Artur Simonyan_09", "Слово от пастора Артура Симоняна - 1 сентября.mp3"),
      "",
    );
    const res = buildCatalogPlaylist(root, profile("simonyan"), {
      month: 9,
      year: 2026,
    });
    expect(res.entries[0].title).toBe("Слово от пастора Артура Симоняна");
  });

  it("Joyce Meyer: сохраняет «сегодняшнее наименование»", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "11 Joyce Meyer_podcast_09"));
    fs.writeFileSync(
      path.join(root, "11 Joyce Meyer_podcast_09", "Джойс Майер - Слушайте Бога каждое утро - 1 сентября.mp3"),
      "",
    );
    const res = buildCatalogPlaylist(root, profile("joyce"), {
      month: 9,
      year: 2026,
    });
    expect(res.entries[0].title).toBe("Слушайте Бога каждое утро");
  });

  it("находит папку по ключевому слову, если шаблон не совпал", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "Renner_старое_09"));
    fs.writeFileSync(
      path.join(root, "Renner_старое_09", "Драгоценные истины - Тест (2 сентября).mp3"),
      "",
    );
    const res = buildCatalogPlaylist(root, profile("renner"), {
      month: 9,
      year: 2026,
    });
    expect(res.folder).toContain("Renner_старое_09");
    expect(res.entries).toHaveLength(1);
  });

  it("помечает треки без даты как unmatched", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "ODB_Podcast_09"));
    fs.writeFileSync(
      path.join(root, "ODB_Podcast_09", "Без даты.mp3"),
      "",
    );
    const res = buildCatalogPlaylist(root, profile("odp"), {
      month: 9,
      year: 2026,
    });
    expect(res.unmatched).toEqual(["Без даты.mp3"]);
  });

  it("buildCatalogPlaylistFromFiles работает без ФС (путь FTP)", () => {
    const files = [
      "Хлеб Наш Насущный - Сегодняшнее чтение 05-09-2026.mp3",
      "Хлеб Наш Насущный - Сегодняшнее чтение 01-09-2026.mp3",
      "Без даты.mp3",
    ];
    const res = buildCatalogPlaylistFromFiles(
      files,
      "/Server_1/ODB_Podcast_09",
      profile("odp"),
      { month: 9, year: 2026 },
      (f) => `/Server_1/ODB_Podcast_09/${f}`,
    );
    expect(res.entries).toHaveLength(2);
    expect(res.entries[0].day).toBe(1);
    expect(res.entries[0].originalPath).toBe(
      "/Server_1/ODB_Podcast_09/Хлеб Наш Насущный - Сегодняшнее чтение 01-09-2026.mp3",
    );
    expect(res.unmatched).toEqual(["Без даты.mp3"]);
  });
});

describe("writeM3U / buildAllPlaylists", () => {
  it("пишет корректный M3U и собирает все рубрики", () => {
    const root = makeRoot();
    fs.ensureDirSync(path.join(root, "ODB_Podcast_09"));
    fs.writeFileSync(
      path.join(root, "ODB_Podcast_09", "Хлеб Наш Насущный - Сегодняшнее чтение 01-09-2026.mp3"),
      "",
    );

    const results = buildAllPlaylists(root, { month: 9, year: 2026 });
    expect(results).toHaveLength(CATALOGS.length);

    const out = path.join(root, "out", "odp.m3u");
    const odp = results.find((r) => r.profile.id === "odp")!;
    writeM3U(odp.entries, out, { relative: false });

    const content = fs.readFileSync(out, "utf8");
    expect(content.startsWith("#EXTM3U")).toBe(true);
    expect(content).toContain("#EXTINF:-1,Сегодняшнее чтение");
    expect(content).toContain("ODB_Podcast_09");
  });
});

describe("resolveCatalogFolderName", () => {
  const dirs = [
    "ODB_Podcast_09",
    "08 Доброе Духовное",
    "69 Renner_podcast_09",
    "90 Artur Simonyan_09",
    "11 Joyce Meyer_podcast_09",
  ];

  it("находит Renner без года в имени папки", () => {
    const name = resolveCatalogFolderName(dirs, profile("renner"), {
      month: 9,
      year: 2026,
    });
    expect(name).toBe("69 Renner_podcast_09");
  });

  it("находит Renner с годом, совпадающим с целевым", () => {
    const withYear = ["69 Renner_podcast_09_2026", "ODB_Podcast_09"];
    const name = resolveCatalogFolderName(withYear, profile("renner"), {
      month: 9,
      year: 2026,
    });
    expect(name).toBe("69 Renner_podcast_09_2026");
  });

  it("находит по ключевому слову, если шаблон не совпал", () => {
    const alt = ["Renner_старое_09"];
    const name = resolveCatalogFolderName(alt, profile("renner"), {
      month: 9,
      year: 2026,
    });
    expect(name).toBe("Renner_старое_09");
  });
});
