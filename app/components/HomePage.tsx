"use client";

import { useState, useEffect, useCallback } from "react";
import DownloadTrack from "./DownloadTrack";
import TrackPlayer from "./TrackPlayer";
import MetadataEditor from "./MetadataEditor";
import FtpUploader from "./FtpUploader";
import TrackStatusBadge from "./shared/TrackStatusBadge";
import TrackManager from "./TrackManager";
import PlayList from "./PlayList";
import { Track } from "@/types/track";
import { getAllTracks, changeTrackStatusAction } from "@/lib/actions/trackActions";
import { useTracksRealtime } from "@/lib/hooks/useTracksRealtime";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { getSupabase } from "@/lib/supabase/client";
import { useI18n } from "./I18nProvider";
import { isAdminUserClient } from "@/lib/auth/admin";
import type { User } from "@supabase/supabase-js";

const OVERVIEW_STATUS_FILTERS = [
  "all",
  "downloaded",
  "reviewed_approved",
  "reviewed_rejected",
  "trimmed",
  "ready_for_upload",
  "uploaded_ftp",
  "uploaded_radio",
] as const;

export default function HomePage() {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [onRadioMap, setOnRadioMap] = useState<Record<string, boolean>>({});
  const [isCheckingRadio, setIsCheckingRadio] = useState(false);
  const [isSyncingRadio, setIsSyncingRadio] = useState(false);
  const [syncRadioError, setSyncRadioError] = useState<string | null>(null);
  const [syncRadioMessage, setSyncRadioMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("download");
  const [overviewFilter, setOverviewFilter] = useState<(typeof OVERVIEW_STATUS_FILTERS)[number]>("all");
  const [clearingErrorId, setClearingErrorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [user, setUser] = useState<Partial<Pick<User, "id" | "email">> | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkTracksOnRadio = async () => {
    if (tracks.length === 0) {
      setOnRadioMap({});
      return;
    }
    setIsCheckingRadio(true);
    try {
      const r = await fetch("/api/radio/check-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: tracks.map((t) => ({
            id: t.id,
            metadata: { title: t.metadata.title, artist: t.metadata.artist },
          })),
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setOnRadioMap(data.onRadio || {});
      const onRadioIds = new Set(
        Object.entries(data.onRadio || {})
          .filter(([, value]) => Boolean(value))
          .map(([trackId]) => trackId)
      );
      if (onRadioIds.size > 0) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            onRadioIds.has(track.id) && track.status !== "uploaded_radio"
              ? { ...track, status: "uploaded_radio" }
              : track
          )
        );
      }
    } catch {
      setOnRadioMap({});
    } finally {
      setIsCheckingRadio(false);
    }
  };

  const syncRadioTracks = async () => {
    setIsSyncingRadio(true);
    setSyncRadioError(null);
    setSyncRadioMessage(null);
    try {
      const r = await fetch("/api/radio/sync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      const n = typeof d.count === "number" ? d.count : 0;
      if (n > 0) {
        setSyncRadioMessage(t("messages.syncedN", { n }));
      } else {
        setSyncRadioMessage(t("messages.syncZero"));
      }
      setTimeout(() => setSyncRadioMessage(null), 6000);
      await checkTracksOnRadio();
      await fetchTracks();
    } catch (e) {
      setSyncRadioError(getUserFacingErrorMessage(e, t("errors.syncRadio")));
    } finally {
      setIsSyncingRadio(false);
    }
  };

  useTracksRealtime(
    (updatedTrack) => {
      setTracks((prevTracks) =>
        prevTracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
      );
    },
    (newTrack) => {
      setTracks((prevTracks) => [...prevTracks, newTrack]);
    },
    (deletedTrackId) => {
      setTracks((prevTracks) => prevTracks.filter((t) => t.id !== deletedTrackId));
    }
  );

  const fetchTracks = useCallback(async () => {
    setLoadError(null);
    try {
      const tracksData = await getAllTracks();
      setTracks(tracksData);
    } catch (error) {
      console.error("Error fetching tracks:", error);
      setLoadError(getUserFacingErrorMessage(error, t("errors.loadTracks")));
    }
  }, [t]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const admin = await isAdminUserClient(user?.id);
      if (!cancelled) {
        setIsAdmin(admin);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (tracks.length === 0) {
      setOnRadioMap({});
      return;
    }
    fetch("/api/radio/check-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: tracks.map((t) => ({
          id: t.id,
          metadata: { title: t.metadata.title, artist: t.metadata.artist },
        })),
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setOnRadioMap(data.onRadio || {}))
      .catch(() => setOnRadioMap({}));
  }, [tracks]);

  const allTabs = [
    { id: "download", label: t("tabs.download"), component: DownloadTrack },
    { id: "listen", label: t("tabs.listen"), component: TrackPlayer },
    { id: "metadata", label: t("tabs.metadata"), component: MetadataEditor },
    { id: "upload", label: t("tabs.upload"), component: FtpUploader },
    { id: "manage", label: t("tabs.manage"), component: TrackManager },
    { id: "playlist", label: t("tabs.playlist"), component: PlayList },
  ];

  const tabs = isAdmin
    ? allTabs
    : allTabs.filter((tab) => !["upload", "manage", "playlist"].includes(tab.id));

  useEffect(() => {
    if (
      !isAdmin &&
      (activeTab === "upload" || activeTab === "manage" || activeTab === "playlist")
    ) {
      setActiveTab("download");
    }
  }, [isAdmin, activeTab]);

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || DownloadTrack;
  const overviewTabs = OVERVIEW_STATUS_FILTERS.map((status) => ({
    id: status,
    label:
      status === "all"
        ? t("overview.filters.all")
        : status === "downloaded"
          ? t("overview.filters.downloaded")
          : status === "reviewed_approved"
            ? t("overview.filters.reviewedApproved")
            : status === "reviewed_rejected"
              ? t("overview.filters.reviewedRejected")
              : status === "trimmed"
                ? t("overview.filters.trimmed")
                : status === "ready_for_upload"
                  ? t("overview.filters.readyForUpload")
                  : status === "uploaded_ftp"
                    ? t("overview.filters.uploadedFtp")
                    : t("overview.filters.uploadedRadio"),
  }));
  const overviewTracks =
    overviewFilter === "all"
      ? tracks
      : tracks.filter((track) => track.status === overviewFilter);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-300 text-sm">
          {loadError}
        </div>
      )}
      <nav className="flex space-x-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary-600 text-white dark:bg-primary-500"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="card">
        <ActiveComponent onTracksUpdate={fetchTracks} tracks={tracks} onRadioMap={onRadioMap} />
      </div>

      {tracks.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">{t("overview.title")}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={syncRadioTracks}
                disabled={isSyncingRadio}
                className="btn btn-secondary text-sm disabled:opacity-50"
                title={t("overview.syncRadio")}
              >
                {isSyncingRadio ? t("overview.syncing") : t("overview.syncRadio")}
              </button>
            </div>
          </div>
          {syncRadioError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mb-2">{syncRadioError}</p>
          )}
          {syncRadioMessage && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-2">{syncRadioMessage}</p>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {overviewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOverviewFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  overviewFilter === tab.id
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {t("overview.table.track")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {t("overview.table.artist")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {t("overview.table.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {t("overview.table.error")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {t("overview.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {overviewTracks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t("trackList.emptyDefault")}
                    </td>
                  </tr>
                ) : (
                  overviewTracks.map((track) => (
                    <tr key={track.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {track.metadata.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-300">
                        {track.metadata.artist}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <TrackStatusBadge status={track.status} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {track.error ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs text-danger-600 dark:text-danger-400 max-w-xs">
                              {t("overview.errorLabel")}: {track.error}
                            </p>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (clearingErrorId) return;
                                setClearingErrorId(track.id);
                                try {
                                  await changeTrackStatusAction(
                                    track.id,
                                    track.processedPath ? "ready_for_upload" : "downloaded"
                                  );
                                  await fetchTracks();
                                } finally {
                                  setClearingErrorId(null);
                                }
                              }}
                              disabled={!!clearingErrorId}
                              className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                            >
                              {clearingErrorId === track.id ? "…" : t("overview.clearError")}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-500">—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
