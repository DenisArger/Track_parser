/**
 * Формирование месячных плейлистов (M3U) для всех рубрик.
 *
 * Пример:
 *   yarn playlists --root /Server_1 --month 9 --year 2026
 *   yarn playlists --root /Server_1 --month 9 --year 2026 --relative --out ./playlists/2026-09
 *
 * Результат: по одному .m3u на рубрику (отсортированному по дням месяца)
 * и report.json с неразобранными треками.
 */

import fs from "fs-extra";
import path from "path";
import {
  buildAllPlaylists,
  buildCatalogPlaylist,
  CatalogResult,
  TargetMonth,
  writeM3U,
  resolveRubric,
} from "../lib/playlists";
import { CATALOGS } from "../lib/playlists/catalogs";

interface Args {
  root: string;
  month: number;
  year: number;
  out: string;
  relative: boolean;
  rename: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      a[key] = next;
      i += 1;
    } else {
      a[key] = true;
    }
  }

  if (!a.root || typeof a.root !== "string") {
    throw new Error("Укажите --root <путь к каталогам на сервере>");
  }
  const month = Number(a.month);
  const year = Number(a.year ?? new Date().getFullYear());
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("--month должен быть от 1 до 12");
  }

  const out =
    (typeof a.out === "string" && a.out) ||
    path.join("playlists", `${year}-${String(month).padStart(2, "0")}`);

  return {
    root: a.root as string,
    month,
    year,
    out: out as string,
    relative: Boolean(a.relative),
    rename: Boolean(a.rename),
    dryRun: Boolean(a.dryRun),
  };
}

function safeName(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function runRename(
  result: CatalogResult,
  opts: Args,
): Promise<{ renamed: number; skipped: number }> {
  let renamed = 0;
  let skipped = 0;
  for (const e of result.entries) {
    const ext = path.extname(e.originalName);
    const target = path.join(
      result.folder as string,
      `${safeName(e.canonicalName)}${ext}`,
    );
    if (target === e.originalPath) {
      skipped += 1;
      continue;
    }
    if (opts.dryRun) {
      renamed += 1;
      continue;
    }
    if (await fs.pathExists(target)) {
      skipped += 1;
      continue;
    }
    await fs.rename(e.originalPath, target);
    e.originalPath = target;
    e.originalName = path.basename(target);
    renamed += 1;
  }
  return { renamed, skipped };
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const target: TargetMonth = { month: opts.month, year: opts.year };

  console.log(
    `Формирование плейлистов: корень=${opts.root} месяц=${opts.month} год=${opts.year}`,
  );
  if (!fs.existsSync(opts.root)) {
    throw new Error(`Корень не найден: ${opts.root}`);
  }

  const results = buildAllPlaylists(opts.root, target, CATALOGS);
  const report: Record<string, unknown> = {
    root: opts.root,
    target,
    generatedAt: new Date().toISOString(),
    playlists: [],
  };

  for (const r of results) {
    const rubricSafe = safeName(resolveRubric(r.profile, target)).replace(/\s+/g, "_");
    const m3uPath = path.join(opts.out, `${rubricSafe}.m3u`);
    const info: Record<string, unknown> = {
      id: r.profile.id,
      rubric: resolveRubric(r.profile, target),
      folder: r.folder,
      tracks: r.entries.length,
      m3u: opts.relative ? path.relative(process.cwd(), m3uPath) : m3uPath,
      unmatched: r.unmatched,
      otherMonths: r.otherMonths,
    };

    if (!r.folder) {
      console.warn(`[пропущено] ${resolveRubric(r.profile, target)}: папка не найдена`);
    } else if (r.entries.length === 0 && r.unmatched.length === 0) {
      console.warn(
        `[пусто] ${resolveRubric(r.profile, target)}: треков за ${opts.month}/${opts.year} нет`,
      );
    } else {
      if (opts.rename) {
        const { renamed, skipped } = await runRename(r, opts);
        info.renamed = renamed;
        info.renameSkipped = skipped;
      }
      writeM3U(r.entries, m3uPath, { relative: opts.relative });
      console.log(
        `[ok] ${resolveRubric(r.profile, target)}: ${r.entries.length} трек(ов) -> ${m3uPath}`,
      );
    }

    if (r.unmatched.length) {
      console.warn(
        `     неразобрано (нет даты в имени): ${r.unmatched.length}`,
      );
    }
    (report.playlists as unknown[]).push(info);
  }

  if (!opts.dryRun) {
    const reportPath = path.join(opts.out, "report.json");
    fs.ensureDirSync(opts.out);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Отчёт: ${reportPath}`);
  }
}

run().catch((err) => {
  console.error("Ошибка формирования плейлистов:", err);
  process.exit(1);
});
