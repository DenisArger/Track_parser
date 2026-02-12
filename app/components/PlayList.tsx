"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "./I18nProvider";

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
  rating?: number | null;
  created_at?: string | null;
};

type AgeGroup = "old" | "new" | "any";

type TemplateRow = {
  id: string;
  trackType: string;
  ageGroup: AgeGroup;
  count: number;
  useGlobalLimits?: boolean;
  artistGapMinutes?: number;
  trackGapMinutes?: number;
};

type GeneratedItem = {
  rowId: string;
  rowLabel: string;
  track: PlaylistTrack | null;
  reason?: string;
};

type RelatedGroup = {
  id: string;
  name: string;
  members: string[];
};

type RotationSettings = {
  targetHours: number;
  targetMinutes: number;
  avgMinutes: number;
  avgSeconds: number;
  minArtistGapMinutes: number;
  minTrackGapMinutes: number;
};

const TRACK_TYPE_OPTIONS = [
  "Быстрый",
  "Средний",
  "Медленный",
  "Модерн",
  "Любой",
];

function normalizeTrackType(value: string | null): string {
  return (value || "").trim().toLowerCase();
}

function normalizeArtistName(value: string | null): string {
  return (value || "").trim().toLowerCase();
}

function isOldTrack(year: number | null): boolean {
  return year === null || year <= 2022;
}

function isNewTrack(year: number | null): boolean {
  return year !== null && year >= 2023;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx] ?? null;
}

function pickWeightedByRating(
  items: PlaylistTrack[],
): PlaylistTrack | null {
  if (items.length === 0) return null;
  let total = 0;
  const weights = items.map((t) => {
    const r = typeof t.rating === "number" ? t.rating : 0;
    const w = Math.min(10, Math.max(1, Math.trunc(r) || 1));
    total += w;
    return w;
  });
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i] ?? null;
  }
  return items[items.length - 1] ?? null;
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
  const { t } = useI18n();
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateRow[]>([
    { id: "r1", trackType: "Быстрый", ageGroup: "old", count: 1, useGlobalLimits: true },
    { id: "r2", trackType: "Быстрый", ageGroup: "new", count: 1, useGlobalLimits: true },
    { id: "r3", trackType: "Средний", ageGroup: "old", count: 1, useGlobalLimits: true },
    { id: "r4", trackType: "Средний", ageGroup: "new", count: 1, useGlobalLimits: true },
    { id: "r5", trackType: "Медленный", ageGroup: "new", count: 1, useGlobalLimits: true },
  ]);
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [targetHours, setTargetHours] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [avgMinutes, setAvgMinutes] = useState(3);
  const [avgSeconds, setAvgSeconds] = useState(30);
  const [useRecentOnly, setUseRecentOnly] = useState(false);
  const [recentDays, setRecentDays] = useState(14);
  const [minArtistGapMinutes, setMinArtistGapMinutes] = useState(0);
  const [minTrackGapMinutes, setMinTrackGapMinutes] = useState(0);
  const [relatedGroups, setRelatedGroups] = useState<RelatedGroup[]>([]);
  const [relatedSaving, setRelatedSaving] = useState(false);
  const [relatedMessage, setRelatedMessage] = useState<string | null>(null);
  const [showRelatedGroups, setShowRelatedGroups] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("default");
  const [exportFileName, setExportFileName] = useState("playlist");
  const [uploadName, setUploadName] = useState("playlist");
  const [uploadNameTouched, setUploadNameTouched] = useState(false);
  const [uploadServerId, setUploadServerId] = useState(1);
  const [uploadRandom, setUploadRandom] = useState(false);
  const [uploadBasePath, setUploadBasePath] = useState("");
  const [uploadWin1251, setUploadWin1251] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const trackTypeLabelMap = useMemo(
    () => ({
      "Быстрый": t("playlist.trackType.fast"),
      "Средний": t("playlist.trackType.mid"),
      "Медленный": t("playlist.trackType.slow"),
      "Модерн": t("playlist.trackType.modern"),
      "Любой": t("playlist.trackType.any"),
    }),
    [t]
  );
  const ageOptions = useMemo(
    () => [
      { value: "old" as AgeGroup, label: t("playlist.age.old") },
      { value: "new" as AgeGroup, label: t("playlist.age.new") },
      { value: "any" as AgeGroup, label: t("playlist.age.any") },
    ],
    [t]
  );
  const formatRowLabel = useCallback(
    (row: TemplateRow) => {
      const ageSuffix =
        row.ageGroup === "any"
          ? ""
          : row.ageGroup === "old"
            ? ` (${t("playlist.ageSuffix.old")})`
            : ` (${t("playlist.ageSuffix.new")})`;
      const typeLabel = trackTypeLabelMap[row.trackType as keyof typeof trackTypeLabelMap] || row.trackType;
      return `${typeLabel}${ageSuffix}`;
    },
    [t, trackTypeLabelMap]
  );

  const loadTracks = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const r = await fetch("/api/playlist/related-groups");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || String(r.status));
        setRelatedGroups(Array.isArray(d.groups) ? d.groups : []);
      } catch (e) {
        setRelatedMessage(
          e instanceof Error ? e.message : t("playlist.groupsLoadError")
        );
      }
    };
    loadGroups();
  }, [t]);

  const loadTemplate = useCallback(async (name: string) => {
    try {
      const r = await fetch(
        `/api/playlist/rotation-template?name=${encodeURIComponent(name)}`
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      if (Array.isArray(d.template) && d.template.length > 0) {
        setTemplate(d.template as TemplateRow[]);
      }
      if (d.settings && typeof d.settings === "object") {
        const s = d.settings as Partial<RotationSettings>;
        if (typeof s.targetHours === "number") setTargetHours(s.targetHours);
        if (typeof s.targetMinutes === "number")
          setTargetMinutes(s.targetMinutes);
        if (typeof s.avgMinutes === "number") setAvgMinutes(s.avgMinutes);
        if (typeof s.avgSeconds === "number") setAvgSeconds(s.avgSeconds);
        if (typeof s.minArtistGapMinutes === "number")
          setMinArtistGapMinutes(s.minArtistGapMinutes);
        if (typeof s.minTrackGapMinutes === "number")
          setMinTrackGapMinutes(s.minTrackGapMinutes);
      }
      setTemplateMessage(t("playlist.templateLoaded", { name }));
    } catch (e) {
      setTemplateMessage(
        e instanceof Error ? e.message : t("playlist.templateLoadError")
      );
    }
  }, [t]);

  useEffect(() => {
    loadTemplate(templateName);
  }, [loadTemplate, templateName]);

  useEffect(() => {
    if (!uploadNameTouched) {
      setUploadName(exportFileName || "playlist");
    }
  }, [exportFileName, uploadNameTouched]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("playlistUploadBasePath");
      if (stored !== null) {
        setUploadBasePath(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("playlistUploadBasePath", uploadBasePath);
    } catch {
      // ignore storage errors
    }
  }, [uploadBasePath]);

  const recentCutoffMs = useMemo(
    () => Date.now() - Math.max(1, recentDays) * 24 * 60 * 60 * 1000,
    [recentDays]
  );

  const tracksForGeneration = useMemo(() => {
    if (!useRecentOnly) return tracks;
    return tracks.filter((t) => {
      if (!t.created_at) return false;
      const timestamp = Date.parse(t.created_at);
      return Number.isFinite(timestamp) && timestamp >= recentCutoffMs;
    });
  }, [tracks, useRecentOnly, recentCutoffMs]);

  const availableStats = useMemo(() => {
    const total = tracksForGeneration.length;
    const oldCount = tracksForGeneration.filter((t) => isOldTrack(t.year)).length;
    const newCount = tracksForGeneration.filter((t) => isNewTrack(t.year)).length;
    return { total, oldCount, newCount };
  }, [tracksForGeneration]);

  const relatedIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of relatedGroups) {
      for (const m of g.members) {
        const key = normalizeArtistName(m);
        if (key && !map.has(key)) {
          map.set(key, g.id);
        }
      }
    }
    return map;
  }, [relatedGroups]);

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

    const canUseTrack = (
      t: PlaylistTrack,
      nowSeconds: number,
      artistGapMinutes: number,
      trackGapMinutes: number
    ): boolean => {
      if (artistGapMinutes > 0) {
        const artistKey = normalizeArtistName(t.artist);
        if (artistKey) {
          const groupId = relatedIndex.get(artistKey);
          const scopeKey = groupId ? `group:${groupId}` : artistKey;
          const lastAt = lastArtistAt.get(scopeKey);
          if (
            typeof lastAt === "number" &&
            nowSeconds - lastAt < artistGapMinutes * 60
          ) {
            return false;
          }
        }
      }
      if (trackGapMinutes > 0) {
        const key = trackKey(t);
        const lastAt = lastTrackAt.get(key);
        if (
          typeof lastAt === "number" &&
          nowSeconds - lastAt < trackGapMinutes * 60
        ) {
          return false;
        }
      }
      return true;
    };

    const pickWithLimits = (
      pool: PlaylistTrack[],
      nowSeconds: number,
      artistGapMinutes: number,
      trackGapMinutes: number
    ): PlaylistTrack | null => {
      if (pool.length === 0) return null;
      const filtered = pool.filter((t) =>
        canUseTrack(t, nowSeconds, artistGapMinutes, trackGapMinutes)
      );
      if (filtered.length === 0) return null;
      return pickWeightedByRating(filtered);
    };

    const recordUse = (t: PlaylistTrack | null, nowSeconds: number) => {
      if (!t) return;
      const artistKey = normalizeArtistName(t.artist);
      if (artistKey) {
        const groupId = relatedIndex.get(artistKey);
        const scopeKey = groupId ? `group:${groupId}` : artistKey;
        lastArtistAt.set(scopeKey, nowSeconds);
      }
      const key = trackKey(t);
      lastTrackAt.set(key, nowSeconds);
    };

    const getPool = (row: TemplateRow) => {
      const key = `${row.trackType}|${row.ageGroup}`;
      if (pools.has(key)) return pools.get(key) || [];
      const typeNorm = normalizeTrackType(row.trackType);
      const pool = tracksForGeneration.filter((t) => {
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
          const useGlobal = row.useGlobalLimits !== false;
          const artistGapMinutes = useGlobal
            ? minArtistGapMinutes
            : Math.max(0, row.artistGapMinutes ?? 0);
          const trackGapMinutes = useGlobal
            ? minTrackGapMinutes
            : Math.max(0, row.trackGapMinutes ?? 0);
          if (pool.length === 0) {
            items.push({
              rowId: row.id,
              rowLabel: formatRowLabel(row),
              track: null,
              reason: t("playlist.noTracks"),
            });
            setGenerated(items);
            return;
          }
          for (let i = 0; i < count; i += 1) {
            if (totalSeconds >= targetTotalSeconds || safety >= maxItems) break;
            const picked = pickWithLimits(
              pool,
              totalSeconds,
              artistGapMinutes,
              trackGapMinutes
            );
            items.push({
              rowId: row.id,
              rowLabel: formatRowLabel(row),
              track: picked,
              reason: picked ? undefined : t("playlist.noTracksWithLimits"),
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
      const useGlobal = row.useGlobalLimits !== false;
      const artistGapMinutes = useGlobal
        ? minArtistGapMinutes
        : Math.max(0, row.artistGapMinutes ?? 0);
      const trackGapMinutes = useGlobal
        ? minTrackGapMinutes
        : Math.max(0, row.trackGapMinutes ?? 0);
      const count = Number.isFinite(row.count) && row.count > 0 ? row.count : 1;
      for (let i = 0; i < count; i += 1) {
        const picked = pickWithLimits(
          pool,
          totalSeconds,
          artistGapMinutes,
          trackGapMinutes
        );
        items.push({
          rowId: row.id,
          rowLabel: formatRowLabel(row),
          track: picked,
          reason: picked ? undefined : t("playlist.noTracksWithLimits"),
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
    const safeName =
      (exportFileName || "playlist")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "_") || "playlist";
    const blob = new Blob([text], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadToRadio = async () => {
    setUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    try {
      const items = generated
        .map((g) => g.track)
        .filter((t): t is PlaylistTrack => !!t);
      if (items.length === 0) {
        throw new Error(t("playlist.noTracksToUpload"));
      }
          const r = await fetch("/api/radio/upload-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName || exportFileName || "playlist",
          serverId: uploadServerId,
          isRandom: uploadRandom,
          basePath: uploadBasePath,
          useWindows1251: uploadWin1251,
          tracks: items.map((t) => ({
            raw_name: t.raw_name,
            artist: t.artist,
            title: t.title,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setUploadMessage(t("playlist.uploadSuccess"));
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : t("playlist.uploadError")
      );
    } finally {
      setUploading(false);
    }
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
      {
        id: nextId,
        trackType: "Средний",
        ageGroup: "any",
        count: 1,
        useGlobalLimits: true,
      },
    ]);
  };

  const saveTemplate = async () => {
    setTemplateSaving(true);
    setTemplateMessage(null);
    const settings: RotationSettings = {
      targetHours,
      targetMinutes,
      avgMinutes,
      avgSeconds,
      minArtistGapMinutes,
      minTrackGapMinutes,
    };
    try {
      const r = await fetch("/api/playlist/rotation-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, template, settings }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setTemplateMessage(t("playlist.templateSaved", { name: templateName }));
    } catch (e) {
      setTemplateMessage(
        e instanceof Error ? e.message : t("playlist.templateSaveError")
      );
    } finally {
      setTemplateSaving(false);
    }
  };

  const addRelatedGroup = () => {
    const id = `g${Date.now()}`;
    setRelatedGroups((prev) => [
      ...prev,
      { id, name: t("playlist.groupDefaultName"), members: [] },
    ]);
  };

  const updateRelatedGroup = (id: string, patch: Partial<RelatedGroup>) => {
    setRelatedGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  };

  const removeRelatedGroup = (id: string) => {
    setRelatedGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const parseMembers = (value: string): string[] =>
    value
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);

  const saveRelatedGroups = async () => {
    setRelatedSaving(true);
    setRelatedMessage(null);
    try {
      const r = await fetch("/api/playlist/related-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: relatedGroups }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setRelatedMessage(t("playlist.groupsSaved"));
    } catch (e) {
      setRelatedMessage(
        e instanceof Error ? e.message : t("playlist.groupsSaveError")
      );
    } finally {
      setRelatedSaving(false);
    }
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
            {t("playlist.title")}
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
          {isLoading ? t("playlist.loading") : t("playlist.refreshTracks")}
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
          <h3 className="text-lg font-medium">Связанные исполнители</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRelatedGroups((v) => !v)}
              className="btn btn-secondary text-sm"
            >
              {showRelatedGroups ? "Скрыть" : "Показать"}
            </button>
            <button
              type="button"
              onClick={addRelatedGroup}
              className="btn btn-secondary text-sm"
            >
              {t("playlist.addGroup")}
            </button>
            <button
              type="button"
              onClick={saveRelatedGroups}
              disabled={relatedSaving}
              className="btn btn-primary text-sm disabled:opacity-50"
            >
              {relatedSaving ? t("playlist.saving") : t("playlist.save")}
            </button>
          </div>
        </div>

        {relatedMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {relatedMessage}
          </p>
        )}

        {showRelatedGroups && (
          <>
            {relatedGroups.length === 0 ? (
              <p className="text-sm text-gray-500">
                {t("playlist.groupsEmpty")}
              </p>
            ) : (
              <div className="space-y-3">
                {relatedGroups.map((g) => (
                  <div
                    key={g.id}
                    className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <input
                        type="text"
                        value={g.name}
                        onChange={(e) =>
                          updateRelatedGroup(g.id, { name: e.target.value })
                        }
                        className="flex-1 min-w-[160px] rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        placeholder={t("playlist.groupNamePlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() => removeRelatedGroup(g.id)}
                        className="btn btn-secondary text-xs"
                      >
                        {t("playlist.delete")}
                      </button>
                    </div>
                    <label className="block text-xs text-gray-500 mb-1">
                      {t("playlist.groupMembersLabel")}
                    </label>
                    <textarea
                      value={g.members.join("\n")}
                      onChange={(e) =>
                        updateRelatedGroup(g.id, {
                          members: parseMembers(e.target.value),
                        })
                      }
                      rows={4}
                      className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium">{t("playlist.durationTitle")}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t("playlist.targetDuration")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">{t("playlist.hoursShort")}</span>
              <input
                type="number"
                min={0}
                max={59}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">{t("playlist.minutesShort")}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t("playlist.targetHint")}
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t("playlist.avgDuration")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={avgMinutes}
                onChange={(e) => setAvgMinutes(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">{t("playlist.minutesShort")}</span>
              <input
                type="number"
                min={0}
                max={59}
                value={avgSeconds}
                onChange={(e) => setAvgSeconds(Number(e.target.value) || 0)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">{t("playlist.secondsShort")}</span>
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-500 mb-1">
              <input
                type="checkbox"
                checked={useRecentOnly}
                onChange={(e) => setUseRecentOnly(e.target.checked)}
              />
              {t("playlist.recentOnly")}
            </label>
            <label className="block text-xs text-gray-500 mb-1">{t("playlist.recentDays")}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={recentDays}
                onChange={(e) => setRecentDays(Math.max(1, Number(e.target.value) || 1))}
                disabled={!useRecentOnly}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm disabled:opacity-60"
              />
              <span className="text-sm text-gray-500">{t("playlist.daysShort")}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t("playlist.recentHint")}</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t("playlist.estimateTitle")}
            </label>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {generated.length > 0 ? (
                <>
                  {Math.floor(estimatedSeconds / 3600)} ч{" "}
                  {Math.floor((estimatedSeconds % 3600) / 60)} мин
                </>
              ) : (
                t("playlist.noData")
              )}
            </div>
            {targetTotalSeconds > 0 && generated.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {Math.min(
                  100,
                  Math.round((estimatedSeconds / targetTotalSeconds) * 100)
                )}
                {t("playlist.ofTarget")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium">{t("playlist.templateTitle")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">
              {t("playlist.templateName")}
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("playlist.templateNamePlaceholder")}
                className="mt-1 min-w-[180px] rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
            </label>
            <button type="button" onClick={addRow} className="btn btn-secondary text-sm">
              {t("playlist.addRow")}
            </button>
            <button
              type="button"
              onClick={saveTemplate}
              disabled={templateSaving}
              className="btn btn-primary text-sm disabled:opacity-50"
            >
              {templateSaving ? t("playlist.saving") : t("playlist.saveTemplate")}
            </button>
            <button
              type="button"
              onClick={() => loadTemplate(templateName)}
              className="btn btn-secondary text-sm"
            >
              {t("playlist.loadTemplate")}
            </button>
          </div>
        </div>

        {templateMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {templateMessage}
          </p>
        )}

        <div className="space-y-3">
          {template.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-1 md:grid-cols-[minmax(140px,1.1fr)_minmax(200px,1.4fr)_80px_140px_140px_150px_auto] gap-3 items-end border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-500 mb-1">{t("playlist.typeLabel")}</label>
                <select
                  value={row.trackType}
                  onChange={(e) =>
                    updateRow(row.id, { trackType: e.target.value })
                  }
                  className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                >
                  {TRACK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {trackTypeLabelMap[opt as keyof typeof trackTypeLabelMap] || opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-500 mb-1">{t("playlist.ageLabel")}</label>
                <select
                  value={row.ageGroup}
                  onChange={(e) =>
                    updateRow(row.id, {
                      ageGroup: e.target.value as AgeGroup,
                    })
                  }
                  className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                >
                  {ageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <label className="block text-xs text-gray-500 mb-1">{t("playlist.countLabel")}</label>
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

              <label className="text-xs text-gray-500">
                {t("playlist.artistGap")}
                <input
                  type="number"
                  min={0}
                  value={
                    row.useGlobalLimits !== false
                      ? minArtistGapMinutes
                      : row.artistGapMinutes ?? 0
                  }
                  onChange={(e) =>
                    updateRow(row.id, {
                      artistGapMinutes: Number(e.target.value) || 0,
                    })
                  }
                  disabled={row.useGlobalLimits !== false}
                  className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs disabled:opacity-60"
                />
              </label>

              <label className="text-xs text-gray-500">
                {t("playlist.trackGap")}
                <input
                  type="number"
                  min={0}
                  value={
                    row.useGlobalLimits !== false
                      ? minTrackGapMinutes
                      : row.trackGapMinutes ?? 0
                  }
                  onChange={(e) =>
                    updateRow(row.id, {
                      trackGapMinutes: Number(e.target.value) || 0,
                    })
                  }
                  disabled={row.useGlobalLimits !== false}
                  className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs disabled:opacity-60"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-gray-500 mt-5">
                <input
                  type="checkbox"
                  checked={row.useGlobalLimits !== false}
                  onChange={(e) =>
                    updateRow(row.id, { useGlobalLimits: e.target.checked })
                  }
                />
                {t("playlist.globalLimits")}
              </label>

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
                  {t("playlist.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t("playlist.noRepeatArtist")}
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
              {t("playlist.noRepeatTrack")}
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
          <h3 className="text-lg font-medium">{t("playlist.generateTitle")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">
              {t("playlist.playlistName")}
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder={t("playlist.m3uNamePlaceholder")}
                className="mt-1 min-w-[180px] rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
            </label>
            <button type="button" onClick={generate} className="btn btn-primary text-sm">
              {t("playlist.generate")}
            </button>
            <button
              type="button"
              onClick={exportM3u}
              disabled={generated.length === 0}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              {t("playlist.exportM3u")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,1.1fr)_120px_140px_minmax(220px,1.2fr)_140px_auto] gap-3 items-end mb-4">
          <label className="text-xs text-gray-500">
            {t("playlist.uploadName")}
            <input
              type="text"
              value={uploadName}
              onChange={(e) => {
                setUploadNameTouched(true);
                setUploadName(e.target.value);
              }}
              placeholder={t("playlist.uploadNamePlaceholder")}
              className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-500">
            {t("playlist.serverId")}
            <input
              type="number"
              min={1}
              value={uploadServerId}
              onChange={(e) => setUploadServerId(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-gray-500 mt-5">
            <input
              type="checkbox"
              checked={uploadRandom}
              onChange={(e) => setUploadRandom(e.target.checked)}
            />
            {t("playlist.random")}
          </label>
          <label className="text-xs text-gray-500">
            {t("playlist.basePath")}
            <input
              type="text"
              value={uploadBasePath}
              onChange={(e) => setUploadBasePath(e.target.value)}
              placeholder={t("playlist.basePathPlaceholder")}
              className="mt-1 w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-gray-500 mt-5">
            <input
              type="checkbox"
              checked={uploadWin1251}
              onChange={(e) => setUploadWin1251(e.target.checked)}
            />
            {t("playlist.win1251")}
          </label>
          <button
            type="button"
            onClick={uploadToRadio}
            disabled={uploading || generated.length === 0}
            className="btn btn-primary text-sm disabled:opacity-50"
          >
            {uploading ? t("playlist.loading") : t("playlist.uploadToRadio")}
          </button>
        </div>

        {uploadMessage && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-3">
            {uploadMessage}
          </p>
        )}
        {uploadError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {uploadError}
          </p>
        )}

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {t("playlist.available", {
            total: availableStats.total,
            old: availableStats.oldCount,
            new: availableStats.newCount,
          })}
        </div>

        {generated.length === 0 ? (
          <p className="text-gray-500">{t("playlist.generateHint")}</p>
        ) : (
          <div className="space-y-2">
            {generated.map((item, idx) => {
              const track = item.track;
              const display =
                track && (track.artist || track.title)
                  ? [track.artist, track.title].filter(Boolean).join(" - ")
                  : track?.raw_name || "";
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
                        {item.reason || t("playlist.noTrack")}
                      </span>
                    )}
                  </div>
                  {track?.year && (
                    <span className="text-xs text-gray-500">
                      {t("playlist.year")}: {track.year}
                    </span>
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


