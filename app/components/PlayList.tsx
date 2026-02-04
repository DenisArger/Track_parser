"use client";

import { useEffect, useMemo, useState } from "react";

type PlayListProps = {
  onTracksUpdate: () => void;
};

type PlaylistTrack = {
  id: string;
  raw_name: string | null;
  artist: string | null;
  title: string | null;
  track_type: string | null;
  year: number | null;
};

type AgeGroup = "old" | "new" | "any";

type TemplateRow = {
  id: string;
  trackType: string;
  ageGroup: AgeGroup;
  count: number;
};

type GeneratedItem = {
  rowId: string;
  rowLabel: string;
  track: PlaylistTrack | null;
  reason?: string;
};

const TRACK_TYPE_OPTIONS = [
  "Быстрый",
  "Средний",
  "Медленный",
  "Модерн",
  "Любой",
];

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: "old", label: "old (≤2022 или без года)" },
  { value: "new", label: "new (≥2023)" },
  { value: "any", label: "any" },
];

function normalizeTrackType(value: string | null): string {
  return (value || "").trim().toLowerCase();
}

function isOldTrack(year: number | null): boolean {
  return year === null || year <= 2022;
}

function isNewTrack(year: number | null): boolean {
  return year !== null && year >= 2023;
}

function rowLabel(row: TemplateRow): string {
  const ageSuffix =
    row.ageGroup === "any"
      ? ""
      : row.ageGroup === "old"
        ? " (old)"
        : " (new)";
  return `${row.trackType}${ageSuffix}`;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx] ?? null;
}

function buildM3u(tracks: PlaylistTrack[]): string {
  const lines: string[] = ["#EXTM3U"];
  for (const t of tracks) {
    const artist = (t.artist || "").trim();
    const title = (t.title || "").trim();
    const display = [artist, title].filter(Boolean).join(" - ");
    if (display) {
      lines.push(`#EXTINF:-1,${display}`);
    }
    const path = (t.raw_name || display || t.id || "").trim();
    if (path) lines.push(path);
  }
  return lines.join("\n");
}

export default function PlayList({ onTracksUpdate }: PlayListProps) {
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateRow[]>([
    { id: "r1", trackType: "Быстрый", ageGroup: "old", count: 1 },
    { id: "r2", trackType: "Быстрый", ageGroup: "new", count: 1 },
    { id: "r3", trackType: "Средний", ageGroup: "old", count: 1 },
    { id: "r4", trackType: "Средний", ageGroup: "new", count: 1 },
    { id: "r5", trackType: "Медленный", ageGroup: "new", count: 1 },
  ]);
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [targetHours, setTargetHours] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [avgMinutes, setAvgMinutes] = useState(3);
  const [avgSeconds, setAvgSeconds] = useState(30);
  const [minArtistGapMinutes, setMinArtistGapMinutes] = useState(0);
  const [minTrackGapMinutes, setMinTrackGapMinutes] = useState(0);

  const loadTracks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/radio/playlist-tracks");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setTracks(Array.isArray(d.tracks) ? d.tracks : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  const availableStats = useMemo(() => {
    const total = tracks.length;
    const oldCount = tracks.filter((t) => isOldTrack(t.year)).length;
    const newCount = tracks.filter((t) => isNewTrack(t.year)).length;
    return { total, oldCount, newCount };
  }, [tracks]);

  const generate = () => {
    const avgTotalSeconds = Math.max(
      30,
      Math.floor(avgMinutes * 60 + avgSeconds)
    );
    const targetTotalSeconds = Math.max(
      0,
      Math.floor(targetHours * 3600 + targetMinutes * 60)
    );

    const pools = new Map<string, PlaylistTrack[]>();
    const lastArtistAt = new Map<string, number>();
    const lastTrackAt = new Map<string, number>();

    const trackKey = (t: PlaylistTrack): string => {
      const artist = (t.artist || "").trim().toLowerCase();
      const title = (t.title || "").trim().toLowerCase();
      const raw = (t.raw_name || "").trim().toLowerCase();
      if (artist || title) return `${artist}::${title}`;
      return raw || t.id;
    };

    const canUseTrack = (t: PlaylistTrack, nowSeconds: number): boolean => {
      if (minArtistGapMinutes > 0) {
        const artistKey = (t.artist || "").trim().toLowerCase();
        if (artistKey) {
          const lastAt = lastArtistAt.get(artistKey);
          if (
            typeof lastAt === "number" &&
            nowSeconds - lastAt < minArtistGapMinutes * 60
          ) {
            return false;
          }
        }
      }
      if (minTrackGapMinutes > 0) {
        const key = trackKey(t);
        const lastAt = lastTrackAt.get(key);
        if (
          typeof lastAt === "number" &&
          nowSeconds - lastAt < minTrackGapMinutes * 60
        ) {
          return false;
        }
      }
      return true;
    };

    const pickWithLimits = (
      pool: PlaylistTrack[],
      nowSeconds: number
    ): PlaylistTrack | null => {
      if (pool.length === 0) return null;
      const filtered = pool.filter((t) => canUseTrack(t, nowSeconds));
      if (filtered.length === 0) return null;
      return pickRandom(filtered);
    };

    const recordUse = (t: PlaylistTrack | null, nowSeconds: number) => {
      if (!t) return;
      const artistKey = (t.artist || "").trim().toLowerCase();
      if (artistKey) {
        lastArtistAt.set(artistKey, nowSeconds);
      }
      const key = trackKey(t);
      lastTrackAt.set(key, nowSeconds);
    };

    const getPool = (row: TemplateRow) => {
      const key = `${row.trackType}|${row.ageGroup}`;
      if (pools.has(key)) return pools.get(key) || [];
      const typeNorm = normalizeTrackType(row.trackType);
      const pool = tracks.filter((t) => {
        const typeOk =
          row.trackType === "Любой" ||
          normalizeTrackType(t.track_type) === typeNorm;
        const ageOk =
          row.ageGroup === "any"
            ? true
            : row.ageGroup === "old"
              ? isOldTrack(t.year)
              : isNewTrack(t.year);
        return typeOk && ageOk;
      });
      pools.set(key, pool);
      return pool;
    };

    const items: GeneratedItem[] = [];
    let totalSeconds = 0;
    const maxItems = 1000;

    if (targetTotalSeconds > 0) {
      let safety = 0;
      while (totalSeconds < targetTotalSeconds && safety < maxItems) {
        for (const row of template) {
          const count =
            Number.isFinite(row.count) && row.count > 0 ? row.count : 1;
          const pool = getPool(row);
          if (pool.length === 0) {
            items.push({
              rowId: row.id,
              rowLabel: rowLabel(row),
              track: null,
              reason: "Нет подходящих треков",
            });
            setGenerated(items);
            return;
          }
          for (let i = 0; i < count; i += 1) {
            if (totalSeconds >= targetTotalSeconds || safety >= maxItems) break;
            const picked = pickWithLimits(pool, totalSeconds);
            items.push({
              rowId: row.id,
              rowLabel: rowLabel(row),
              track: picked,
              reason: picked ? undefined : "Нет подходящих треков (ограничения повторов)",
            });
            if (picked) {
              recordUse(picked, totalSeconds);
              totalSeconds += avgTotalSeconds;
            }
            safety += 1;
          }
          if (totalSeconds >= targetTotalSeconds || safety >= maxItems) break;
        }
      }
      setGenerated(items);
      return;
    }

    for (const row of template) {
      const pool = getPool(row);
      const count = Number.isFinite(row.count) && row.count > 0 ? row.count : 1;
      for (let i = 0; i < count; i += 1) {
        const picked = pickWithLimits(pool, totalSeconds);
        items.push({
          rowId: row.id,
          rowLabel: rowLabel(row),
          track: picked,
          reason: picked ? undefined : "Нет подходящих треков (ограничения повторов)",
        });
        if (picked) {
          recordUse(picked, totalSeconds);
          totalSeconds += avgTotalSeconds;
        }
      }
    }
    setGenerated(items);
  };

  const exportM3u = () => {
    const list = generated
      .map((g) => g.track)
      .filter((t): t is PlaylistTrack => !!t);
    const text = buildM3u(list);
    const blob = new Blob([text], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playlist.m3u";
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateRow = (id: string, patch: Partial<TemplateRow>) => {
    setTemplate((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const moveRow = (id: string, dir: "up" | "down") => {
    setTemplate((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const nextIdx = dir === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = temp;
      return copy;
    });
  };

  const removeRow = (id: string) => {
    setTemplate((prev) => prev.filter((row) => row.id !== id));
  };

  const addRow = () => {
    const nextId = `r${Date.now()}`;
    setTemplate((prev) => [
      ...prev,
      { id: nextId, trackType: "Средний", ageGroup: "any", count: 1 },
    ]);
  };

  const avgTotalSeconds = Math.max(
    30,
    Math.floor(avgMinutes * 60 + avgSeconds)
  );
  const targetTotalSeconds = Math.max(
    0,
    Math.floor(targetHours * 3600 + targetMinutes * 60)
  );
  const estimatedSeconds = generated.length * avgTotalSeconds;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            PlayList
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            old = год ≤ 2022 или отсутствует
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadTracks}
            disabled={isLoading}
            className="btn btn-secondary text-sm disabled:opacity-50"
          >
            {isLoading ? "Загрузка..." : "Обновить треки"}
          </button>
          <button
            type="button"
            onClick={onTracksUpdate}
            className="btn btn-secondary text-sm"
          >
            Обновить список треков
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium">Длительность (примерно)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Целевая длительность
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">ч</span>
              <input
                type="number"
                min={0}
                max={59}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">мин</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              При генерации шаблон повторяется до достижения цели.
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Средняя длительность трека
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={avgMinutes}
                onChange={(e) => setAvgMinutes(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">мин</span>
              <input
                type="number"
                min={0}
                max={59}
                value={avgSeconds}
                onChange={(e) => setAvgSeconds(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">сек</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Оценка после генерации
            </label>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {generated.length > 0 ? (
                <>
                  {Math.floor(estimatedSeconds / 3600)} ч{" "}
                  {Math.floor((estimatedSeconds % 3600) / 60)} мин
                </>
              ) : (
                "Нет данных"
              )}
            </div>
            {targetTotalSeconds > 0 && generated.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.min(
                  100,
                  Math.round((estimatedSeconds / targetTotalSeconds) * 100)
                )}
                % от цели
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium">Шаблон ротации</h3>
          <button type="button" onClick={addRow} className="btn btn-primary text-sm">
            Добавить строку
          </button>
        </div>

        <div className="space-y-3">
          {template.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-500 mb-1">Тип</label>
                <select
                  value={row.trackType}
                  onChange={(e) =>
                    updateRow(row.id, { trackType: e.target.value })
                  }
                  className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                >
                  {TRACK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-500 mb-1">Возраст</label>
                <select
                  value={row.ageGroup}
                  onChange={(e) =>
                    updateRow(row.id, {
                      ageGroup: e.target.value as AgeGroup,
                    })
                  }
                  className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                >
                  {AGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <label className="block text-xs text-gray-500 mb-1">Кол-во</label>
                <input
                  type="number"
                  min={1}
                  value={row.count}
                  onChange={(e) =>
                    updateRow(row.id, { count: Number(e.target.value) || 1 })
                  }
                  className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveRow(row.id, "up")}
                  className="btn btn-secondary text-xs"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(row.id, "down")}
                  className="btn btn-secondary text-xs"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="btn btn-secondary text-xs"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Не повторять артиста (мин)
            </label>
            <input
              type="number"
              min={0}
              value={minArtistGapMinutes}
              onChange={(e) => setMinArtistGapMinutes(Number(e.target.value) || 0)}
              className="w-32 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Не повторять трек (мин)
            </label>
            <input
              type="number"
              min={0}
              value={minTrackGapMinutes}
              onChange={(e) => setMinTrackGapMinutes(Number(e.target.value) || 0)}
              className="w-32 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium">Генерация</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={generate} className="btn btn-primary text-sm">
              Сгенерировать
            </button>
            <button
              type="button"
              onClick={exportM3u}
              disabled={generated.length === 0}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Экспорт M3U
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Всего треков: {availableStats.total}, old: {availableStats.oldCount},
          new: {availableStats.newCount}
        </div>

        {generated.length === 0 ? (
          <p className="text-gray-500">Нажмите &quot;Сгенерировать&quot;.</p>
        ) : (
          <div className="space-y-2">
            {generated.map((item, idx) => {
              const t = item.track;
              const display =
                t && (t.artist || t.title)
                  ? [t.artist, t.title].filter(Boolean).join(" - ")
                  : t?.raw_name || "";
              return (
                <div
                  key={`${item.rowId}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3 bg-white dark:bg-gray-900 dark:border-gray-700"
                >
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{item.rowLabel}</span>
                    {display ? (
                      <>
                        <span className="mx-2 text-gray-400">—</span>
                        <span>{display}</span>
                      </>
                    ) : (
                      <span className="ml-2 text-red-600 dark:text-red-400">
                        {item.reason || "Нет трека"}
                      </span>
                    )}
                  </div>
                  {t?.year && (
                    <span className="text-xs text-gray-500">год: {t.year}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}





