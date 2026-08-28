"use client";

import { useCallback, useEffect, useState } from "react";
import { FtpConfig } from "@/types/track";
import { useI18n } from "./I18nProvider";
import { formatErrorReportForCopy, reportClientError } from "@/lib/utils/errorReporter";
import Spinner from "./Spinner";
import ErrorDetails from "./ErrorDetails";
import { StreamingCenterTrack } from "@/lib/radio/uploadPlaylistToStreamingCenter";

interface MonthlyEntry {
  day: number;
  title: string;
  dateYmd: string;
  originalPath?: string;
}
interface MonthlyPlaylist {
  id: string;
  rubric: string;
  folder: string | null;
  tracks: number;
  entries: MonthlyEntry[];
  unmatched: string[];
  otherMonths: number;
  m3u: string;
  fileName: string;
}
interface SendResult {
  rubric: string;
  fileName: string;
  tracks: number;
  ok: boolean;
  error?: string;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_") || "playlist";
}

export default function MonthlyRubrics() {
  const { t } = useI18n();
  const [ftpConfig, setFtpConfig] = useState<FtpConfig>({
    host: "",
    port: 21,
    user: "",
    password: "",
    secure: false,
    remotePath: "",
  });
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [month, setMonth] = useState(next.getMonth() + 1);
  const [year, setYear] = useState(next.getFullYear());
  const [relative, setRelative] = useState(false);
  const [serverId, setServerId] = useState(1);
  const [basePath, setBasePath] = useState("");
  const [useWindows1251, setUseWindows1251] = useState(true);
  const [isRandom, setIsRandom] = useState(false);
  const [busy, setBusy] = useState<null | "preview" | "send">(null);
  const [playlists, setPlaylists] = useState<MonthlyPlaylist[]>([]);
  const [sent, setSent] = useState<SendResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [singleResults, setSingleResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [editedEntries, setEditedEntries] = useState<Record<string, MonthlyEntry[]>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/ftp-config");
        if (r.ok) setFtpConfig((await r.json()) as FtpConfig);
      } catch {
        // ignore
      } finally {
        setIsConfigLoading(false);
      }
    };
    load();
  }, []);

  const setDetailedError = (userMessage: string, operation: string, err?: unknown) => {
    setError(userMessage);
    const report = reportClientError(err ?? userMessage, { operation, component: "MonthlyRubrics" });
    setErrorDetails(formatErrorReportForCopy(report));
  };

  const run = useCallback(
    async (action: "preview" | "send") => {
      setBusy(action);
      setError(null);
      setErrorDetails(null);
      setSent(null);
      try {
        const r = await fetch("/api/playlists/monthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ftpConfig, month, year, action, relative, serverId, basePath, useWindows1251, isRandom }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || String(r.status));
        if (action === "preview") {
          setPlaylists(d.playlists as MonthlyPlaylist[]);
        } else {
          setSent(d.sent as SendResult[]);
        }
      } catch (e) {
        setDetailedError(
          e instanceof Error ? e.message : String(e),
          `monthly-${action}`,
          e,
        );
      } finally {
        setBusy(null);
      }
    },
    [ftpConfig, month, year, relative, serverId, basePath, useWindows1251, isRandom],
  );

  const download = (pl: MonthlyPlaylist) => {
    const blob = new Blob([pl.m3u], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName(pl.fileName);
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (playlists.length === 0) return;
    setCustomNames((prev) => {
      const next: Record<string, string> = { ...prev };
      let changed = false;
      for (const pl of playlists) {
        if (!next[pl.id]) {
          next[pl.id] = pl.rubric;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [playlists]);

  const sendSingle = useCallback(
    async (pl: MonthlyPlaylist) => {
      setSendingId(pl.id);
      setSingleResults((prev) => ({ ...prev, [pl.id]: { ok: false } }));
      try {
        const name = customNames[pl.id] || pl.rubric;
        const entries = editedEntries[pl.id] ?? pl.entries;
        const tracks: StreamingCenterTrack[] = entries.map((e) => ({
          raw_name: (e as MonthlyEntry & { originalPath?: string }).originalPath,
          artist: name,
          title: e.title,
        }));
        const r = await fetch("/api/playlists/monthly/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playlistId: pl.id,
            name,
            tracks,
            serverId,
            isRandom,
            basePath,
            useWindows1251,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || String(r.status));
        setSingleResults((prev) => ({ ...prev, [pl.id]: { ok: true } }));
      } catch (e) {
        setSingleResults((prev) => ({
          ...prev,
          [pl.id]: { ok: false, error: e instanceof Error ? e.message : String(e) },
        }));
      } finally {
        setSendingId(null);
      }
    },
    [customNames, editedEntries, serverId, isRandom, basePath, useWindows1251],
  );

  const getEntries = useCallback(
    (pl: MonthlyPlaylist): MonthlyEntry[] => {
      return editedEntries[pl.id] ?? pl.entries;
    },
    [editedEntries],
  );

  const removeTrack = useCallback(
    (plId: string, index: number) => {
      setEditedEntries((prev) => {
        const pl = playlists.find((p) => p.id === plId);
        if (!pl) return prev;
        const current = prev[plId] ?? pl.entries;
        const next = current.filter((_, i) => i !== index);
        return { ...prev, [plId]: next };
      });
    },
    [playlists],
  );

  const moveTrack = useCallback(
    (plId: string, index: number, direction: "up" | "down") => {
      setEditedEntries((prev) => {
        const pl = playlists.find((p) => p.id === plId);
        if (!pl) return prev;
        const current = prev[plId] ?? pl.entries;
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= current.length) return prev;
        const next = [...current];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        return { ...prev, [plId]: next };
      });
    },
    [playlists],
  );

  const totalTracks = playlists.reduce((s, p) => s + getEntries(p).length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t("monthly.title")}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("monthly.description")}
        </p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t("monthly.rootPath")}
            </label>
            <input
              type="text"
              value={ftpConfig.remotePath || ""}
              onChange={(e) =>
                setFtpConfig((c) => ({ ...c, remotePath: e.target.value }))
              }
              placeholder={t("monthly.rootPathPlaceholder")}
              className="w-full rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("monthly.month")}
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value) || 1)}
                className="w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("monthly.year")}
              </label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || year)}
                className="w-24 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <label className="inline-flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={relative}
              onChange={(e) => setRelative(e.target.checked)}
            />
            {t("monthly.relative")}
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={useWindows1251}
              onChange={(e) => setUseWindows1251(e.target.checked)}
            />
            {t("playlist.win1251")}
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={isRandom}
              onChange={(e) => setIsRandom(e.target.checked)}
            />
            {t("playlist.random")}
          </label>
          <label className="text-xs text-gray-500">
            {t("playlist.serverId")}
            <input
              type="number"
              min={1}
              value={serverId}
              onChange={(e) => setServerId(Number(e.target.value) || 1)}
              className="mt-1 w-20 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-500">
            {t("playlist.basePath")}
            <input
              type="text"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder={t("playlist.basePathPlaceholder")}
              className="mt-1 min-w-[200px] rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => run("preview")}
            disabled={busy !== null || isConfigLoading}
            className="btn btn-secondary text-sm disabled:opacity-50"
          >
            {busy === "preview" ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner label={t("monthly.building")} />
                <span>{t("monthly.building")}</span>
              </span>
            ) : (
              t("monthly.build")
            )}
          </button>
          <button
            type="button"
            onClick={() => run("send")}
            disabled={busy !== null || isConfigLoading}
            className="btn btn-primary text-sm disabled:opacity-50"
          >
            {busy === "send" ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner label={t("monthly.sending")} />
                <span>{t("monthly.sending")}</span>
              </span>
            ) : (
              t("monthly.send")
            )}
          </button>
        </div>
      </div>

      {error && (
        <ErrorDetails
          title={t("monthly.sendError")}
          message={error}
          details={errorDetails ?? undefined}
          copyLabel={t("errorPage.copyDetails")}
          copySuccessLabel={t("errorPage.copySuccess")}
          copyErrorLabel={t("errorPage.copyFailed")}
        />
      )}

      {sent && (
        <div className="card">
          <h3 className="text-lg font-medium mb-2">{t("monthly.sent")}</h3>
          <ul className="space-y-1 text-sm">
            {sent.map((s) => (
              <li key={s.fileName}>
                {s.ok ? "✓" : "✗"} {s.rubric} — {s.fileName} ({s.tracks})
                {!s.ok && s.error ? `: ${s.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {playlists.length > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("monthly.tracks")}: {totalTracks}
        </p>
      )}

      <div className="space-y-4">
        {playlists.map((pl) => (
          <div key={pl.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={customNames[pl.id] ?? pl.rubric}
                  onChange={(e) =>
                    setCustomNames((prev) => ({ ...prev, [pl.id]: e.target.value }))
                  }
                  className="text-lg font-medium w-full bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors px-0 py-0.5"
                />
                {pl.folder ? (
                  <p className="text-xs text-gray-500">
                    {t("monthly.tracks")}: {getEntries(pl).length}
                    {pl.otherMonths > 0 && ` · ${t("monthly.otherMonths")}: ${pl.otherMonths}`}
                    {pl.unmatched.length > 0 && ` · ${t("monthly.unmatched")}: ${pl.unmatched.length}`}
                    {editedEntries[pl.id] && editedEntries[pl.id].length !== pl.entries.length && ` (${pl.entries.length})`}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t("monthly.noFolder")}
                  </p>
                )}
              </div>
              {getEntries(pl).length > 0 && singleResults[pl.id] && (
                <span className={`text-sm ${singleResults[pl.id].ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {singleResults[pl.id].ok
                    ? "✓"
                    : "✗ " + (singleResults[pl.id].error || t("monthly.sendError"))}
                </span>
              )}
            </div>
            {getEntries(pl).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => sendSingle(pl)}
                  disabled={sendingId === pl.id}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  {sendingId === pl.id ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Spinner label={t("monthly.sending")} />
                      <span>{t("monthly.sending")}</span>
                    </span>
                  ) : (
                    t("monthly.send")
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => download(pl)}
                  className="btn btn-secondary text-sm"
                >
                  {t("monthly.download")}
                </button>
              </div>
            )}

            {getEntries(pl).length === 0 && pl.unmatched.length === 0 && (
              <p className="text-sm text-gray-500">{t("monthly.empty")}</p>
            )}

            {getEntries(pl).length > 0 && (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                {getEntries(pl).map((e, i) => (
                  <li
                    key={`${e.dateYmd}-${i}`}
                    className="flex items-center gap-2 py-1.5 group"
                  >
                    <span className="text-gray-400 w-20 shrink-0">{e.dateYmd}</span>
                    <span className="flex-1 truncate">{e.title}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveTrack(pl.id, i, "up")}
                        disabled={i === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Вверх"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTrack(pl.id, i, "down")}
                        disabled={i === getEntries(pl).length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Вниз"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTrack(pl.id, i)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Удалить"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {pl.unmatched.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-amber-600 dark:text-amber-400 cursor-pointer">
                  {t("monthly.unmatched")}: {pl.unmatched.length}
                </summary>
                <ul className="mt-2 text-xs text-gray-500 space-y-1">
                  {pl.unmatched.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </details>
            )}

            {getEntries(pl).length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-gray-500 cursor-pointer">
                  {t("monthly.preview")}
                </summary>
                <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                  {getEntries(pl)
                    .map((e) => e.originalPath || e.title)
                    .join("\n")}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
