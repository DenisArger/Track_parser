"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "./I18nProvider";
import {
  formatErrorReportForCopy,
  reportClientError,
} from "@/lib/utils/errorReporter";
import ErrorDetails from "./ErrorDetails";
import Spinner from "./Spinner";

type RecentTrack = {
  id: string;
  raw_name: string | null;
  artist: string | null;
  title: string | null;
  track_type: string | null;
  year: number | null;
  rating?: number | null;
  created_at?: string | null;
};

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_") || "playlist";
}

function formatTrackDate(createdAt?: string | null): string {
  if (!createdAt) return "";
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return createdAt;
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildM3u(tracks: RecentTrack[]): string {
  const lines: string[] = ["#EXTM3U"];
  for (const t of tracks) {
    const artist = (t.artist || "").trim();
    const title = (t.title || "").trim();
    const display = [artist, title].filter(Boolean).join(" - ");
    if (display) lines.push(`#EXTINF:-1,${display}`);
    const path = (t.raw_name || display || t.id || "").trim();
    if (path) lines.push(path);
  }
  return lines.join("\n");
}

export default function RecentPlaylist() {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<RecentTrack[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [recentDays, setRecentDays] = useState(7);
  const [uploadName, setUploadName] = useState("recent-playlist");
  const [uploadServerId, setUploadServerId] = useState(1);
  const [uploadRandom, setUploadRandom] = useState(false);
  const [uploadBasePath, setUploadBasePath] = useState("");
  const [uploadWin1251, setUploadWin1251] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrorDetails, setUploadErrorDetails] = useState<string | null>(null);

  const setDetailedError = (
    userMessage: string,
    operation: string,
    err?: unknown,
    extras: Record<string, unknown> = {},
  ) => {
    setError(userMessage);
    const report = reportClientError(err ?? userMessage, {
      operation,
      component: "RecentPlaylist",
      ...extras,
    });
    setErrorDetails(formatErrorReportForCopy(report));
  };

  const setDetailedUploadError = (
    userMessage: string,
    operation: string,
    err?: unknown,
    extras: Record<string, unknown> = {},
  ) => {
    setUploadError(userMessage);
    const report = reportClientError(err ?? userMessage, {
      operation,
      component: "RecentPlaylist",
      ...extras,
    });
    setUploadErrorDetails(formatErrorReportForCopy(report));
  };

  const loadTracks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorDetails(null);
    try {
      const r = await fetch("/api/radio/playlist-tracks");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setTracks(Array.isArray(d.tracks) ? d.tracks : []);
    } catch (e) {
      setDetailedError(
        e instanceof Error ? e.message : String(e),
        "load-recent-tracks",
        e,
        { endpoint: "/api/radio/playlist-tracks" },
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const recentCutoffMs = useMemo(
    () => Date.now() - Math.max(1, recentDays) * 24 * 60 * 60 * 1000,
    [recentDays],
  );

  const recentTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (!t.created_at) return false;
      const timestamp = Date.parse(t.created_at);
      return Number.isFinite(timestamp) && timestamp >= recentCutoffMs;
    });
  }, [tracks, recentCutoffMs]);

  const selectedTracks = useMemo(() => {
    return recentTracks.filter((t) => selectedIds.has(t.id));
  }, [recentTracks, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedTracks.length === recentTracks.length && recentTracks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recentTracks.map((t) => t.id)));
    }
  }, [recentTracks, selectedTracks.length]);

  const downloadM3u = useCallback(() => {
    if (selectedTracks.length === 0) return;
    const text = buildM3u(selectedTracks);
    const name = safeName(uploadName || "recent-playlist");
    const blob = new Blob([text], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedTracks, uploadName]);

  const uploadToRadio = useCallback(async () => {
    if (selectedTracks.length === 0) {
      setUploadError(t("recentPlaylist.noTracksToUpload"));
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    setUploadErrorDetails(null);
    try {
      const r = await fetch("/api/radio/upload-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName || "recent-playlist",
          serverId: uploadServerId,
          isRandom: uploadRandom,
          basePath: uploadBasePath,
          useWindows1251: uploadWin1251,
          tracks: selectedTracks.map((t) => ({
            raw_name: t.raw_name,
            artist: t.artist,
            title: t.title,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setUploadMessage(t("recentPlaylist.uploadSuccess"));
    } catch (e) {
      setDetailedUploadError(
        e instanceof Error ? e.message : t("recentPlaylist.uploadError"),
        "upload-recent-playlist",
        e,
        { endpoint: "/api/radio/upload-playlist", serverId: uploadServerId },
      );
    } finally {
      setUploading(false);
    }
  }, [selectedTracks, uploadName, uploadServerId, uploadRandom, uploadBasePath, uploadWin1251, t]);

  const allSelected = recentTracks.length > 0 && selectedTracks.length === recentTracks.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t("recentPlaylist.title")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("recentPlaylist.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadTracks}
            disabled={isLoading}
            className="btn btn-secondary text-sm disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner label={t("playlist.loading")} />
                <span>{t("playlist.loading")}</span>
              </span>
            ) : (
              t("playlist.refreshTracks")
            )}
          </button>
        </div>
      </div>

      {error && (
        <ErrorDetails
          title={t("recentPlaylist.errorDetailsTitle")}
          message={error}
          details={errorDetails ?? undefined}
          copyLabel={t("playlist.copyDebugDetails")}
          copySuccessLabel={t("playlist.copyDebugDetailsSuccess")}
          copyErrorLabel={t("playlist.copyDebugDetailsError")}
        />
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t("recentPlaylist.recentDays")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={recentDays}
                onChange={(e) =>
                  setRecentDays(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">{t("playlist.daysShort")}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t("recentPlaylist.recentHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t("recentPlaylist.available", {
                total: recentTracks.length,
                selected: selectedTracks.length,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={recentTracks.length === 0}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              {allSelected ? t("recentPlaylist.selectNone") : t("recentPlaylist.selectAll")}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={recentTracks.length === 0}
                    className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm disabled:opacity-60"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {t("recentPlaylist.track")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {t("recentPlaylist.artist")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {t("recentPlaylist.added")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {recentTracks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                    {t("recentPlaylist.empty")}
                  </td>
                </tr>
              ) : (
                recentTracks.map((track) => (
                  <tr
                    key={track.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(track.id)}
                        onChange={() => toggleSelect(track.id)}
                        className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {track.title || track.raw_name || t("recentPlaylist.noTitle")}
                      </div>
                      {track.track_type && (
                        <p className="text-xs text-gray-500">{track.track_type}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-300">
                      {track.artist || "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-500">
                      {formatTrackDate(track.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-gray-500">
              {t("recentPlaylist.playlistName")}
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder={t("playlist.m3uNamePlaceholder")}
                className="mt-1 min-w-[180px] rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={downloadM3u}
              disabled={selectedTracks.length === 0}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              {t("playlist.exportM3u")}
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTracks.length} {t("recentPlaylist.tracksSelected")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,1.1fr)_120px_140px_minmax(220px,1.2fr)_140px_auto] gap-3 items-end mb-4">
          <label className="text-xs text-gray-500">
            {t("playlist.uploadName")}
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
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
            disabled={uploading || selectedTracks.length === 0}
            className="btn btn-primary text-sm disabled:opacity-50"
          >
            {uploading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner label={t("playlist.loading")} />
                <span>{t("playlist.loading")}</span>
              </span>
            ) : (
              t("playlist.uploadToRadio")
            )}
          </button>
        </div>

        {uploadMessage && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-3">
            {uploadMessage}
          </p>
        )}
        {uploadError && (
          <ErrorDetails
            title={t("recentPlaylist.uploadErrorDetailsTitle")}
            message={uploadError}
            details={uploadErrorDetails ?? undefined}
            copyLabel={t("playlist.copyDebugDetails")}
            copySuccessLabel={t("playlist.copyDebugDetailsSuccess")}
            copyErrorLabel={t("playlist.copyDebugDetailsError")}
          />
        )}
      </div>
    </div>
  );
}
