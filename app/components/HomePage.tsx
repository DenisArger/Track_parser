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

export default function HomePage() {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [onRadioMap, setOnRadioMap] = useState<Record<string, boolean>>({});
  const [isCheckingRadio, setIsCheckingRadio] = useState(false);
  const [isSyncingRadio, setIsSyncingRadio] = useState(false);
  const [syncRadioError, setSyncRadioError] = useState<string | null>(null);
  const [syncRadioMessage, setSyncRadioMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("download");
  const [clearingErrorId, setClearingErrorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
        setUserEmail(data.user?.email?.toLowerCase() ?? null);
      })
      .catch(() => {
        setUserEmail(null);
      });
  }, []);

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

  const isAdminEmail = userEmail === "den.arger@gmail.com";

  const allTabs = [
    { id: "download", label: t("tabs.download"), component: DownloadTrack },
    { id: "listen", label: t("tabs.listen"), component: TrackPlayer },
    { id: "metadata", label: t("tabs.metadata"), component: MetadataEditor },
    { id: "upload", label: t("tabs.upload"), component: FtpUploader },
    { id: "manage", label: t("tabs.manage"), component: TrackManager },
    { id: "playlist", label: t("tabs.playlist"), component: PlayList },
  ];

  const tabs = isAdminEmail
    ? allTabs
    : allTabs.filter((tab) => !["manage", "playlist"].includes(tab.id));

  useEffect(() => {
    if (!isAdminEmail && (activeTab === "manage" || activeTab === "playlist")) {
      setActiveTab("download");
    }
  }, [isAdminEmail, activeTab]);

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || DownloadTrack;

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
              <button
                type="button"
                onClick={checkTracksOnRadio}
                disabled={isCheckingRadio}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                {isCheckingRadio ? t("overview.checking") : t("overview.checkRadio")}
              </button>
            </div>
          </div>
          {syncRadioError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mb-2">{syncRadioError}</p>
          )}
          {syncRadioMessage && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-2">{syncRadioMessage}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
              >
                <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {track.metadata.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {track.metadata.artist}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TrackStatusBadge status={track.status} />
                  {onRadioMap[track.id] && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {t("overview.onRadio")}
                    </span>
                  )}
                </div>
                {track.error && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-danger-600 dark:text-danger-400 flex-1 min-w-0">
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
                            track.processedPath ? "trimmed" : "downloaded"
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
