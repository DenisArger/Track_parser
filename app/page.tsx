"use client";

import { useState, useEffect } from "react";
import DownloadTrack from "./components/DownloadTrack";
import TrackPlayer from "./components/TrackPlayer";
import MetadataEditor from "./components/MetadataEditor";
import FtpUploader from "./components/FtpUploader";
import TrackStatusBadge from "./components/shared/TrackStatusBadge";
import TrackManager from "./components/TrackManager";
import { Track } from "@/types/track";
import { getAllTracks, changeTrackStatusAction } from "@/lib/actions/trackActions";
import { useTracksRealtime } from "@/lib/hooks/useTracksRealtime";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [onRadioMap, setOnRadioMap] = useState<Record<string, boolean>>({});
  const [isCheckingRadio, setIsCheckingRadio] = useState(false);
  const [isSyncingRadio, setIsSyncingRadio] = useState(false);
  const [syncRadioError, setSyncRadioError] = useState<string | null>(null);
  const [syncRadioMessage, setSyncRadioMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("download");
  const [clearingErrorId, setClearingErrorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        setSyncRadioMessage(`Загружено ${n} треков в базу.`);
      } else {
        setSyncRadioMessage(
          "API вернул 0 треков. Проверьте STREAMING_CENTER_PLAYLIST_ID (по умолчанию 1) и что в плейлисте есть треки с полями filename, meta или public_path."
        );
      }
      setTimeout(() => setSyncRadioMessage(null), 6000);
      await checkTracksOnRadio();
    } catch (e) {
      setSyncRadioError(
        getUserFacingErrorMessage(e, "Ошибка синхронизации с радио")
      );
    } finally {
      setIsSyncingRadio(false);
    }
  };

  // Подписка на изменения треков в реальном времени
  const { isConnected } = useTracksRealtime(
    (updatedTrack) => {
      // Обновляем трек в списке
      setTracks((prevTracks) =>
        prevTracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
      );
    },
    (newTrack) => {
      // Добавляем новый трек в список
      setTracks((prevTracks) => [...prevTracks, newTrack]);
    },
    (deletedTrackId) => {
      // Удаляем трек из списка
      setTracks((prevTracks) =>
        prevTracks.filter((t) => t.id !== deletedTrackId)
      );
    }
  );

  useEffect(() => {
    // Load tracks from server
    fetchTracks();
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

  const fetchTracks = async () => {
    setLoadError(null);
    try {
      const tracksData = await getAllTracks();
      setTracks(tracksData);
    } catch (error) {
      console.error("Error fetching tracks:", error);
      setLoadError(getUserFacingErrorMessage(error, "Не удалось загрузить список треков"));
    }
  };

  const tabs = [
    { id: "download", label: "Download Tracks", component: DownloadTrack },
    { id: "listen", label: "Listen & Review", component: TrackPlayer },
    { id: "metadata", label: "Edit Metadata", component: MetadataEditor },
    { id: "upload", label: "FTP Upload", component: FtpUploader },
    { id: "manage", label: "Track Manager", component: TrackManager },
  ];

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || DownloadTrack;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {loadError}
        </div>
      )}
      {/* Navigation Tabs */}
      <nav className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary-600 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active Component */}
      <div className="card">
        <ActiveComponent
          onTracksUpdate={fetchTracks}
          tracks={tracks}
          onRadioMap={onRadioMap}
        />
      </div>

      {/* Tracks Overview */}
      {tracks.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Tracks Overview</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={syncRadioTracks}
                disabled={isSyncingRadio}
                className="btn btn-secondary text-sm disabled:opacity-50"
                title="Загрузить список треков с радио в базу (Streaming.Center API)"
              >
                {isSyncingRadio ? "Синхронизация…" : "Синхронизировать с радио"}
              </button>
              <button
                type="button"
                onClick={checkTracksOnRadio}
                disabled={isCheckingRadio}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                {isCheckingRadio ? "Проверка…" : "Проверить наличие на радио"}
              </button>
            </div>
          </div>
          {syncRadioError && (
            <p className="text-sm text-danger-600 mb-2">{syncRadioError}</p>
          )}
          {syncRadioMessage && (
            <p className="text-sm text-green-600 mb-2">{syncRadioMessage}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((track) => (
              <div key={track.id} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 truncate">
                  {track.metadata.title}
                </h4>
                <p className="text-sm text-gray-600">{track.metadata.artist}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TrackStatusBadge status={track.status} />
                  {onRadioMap[track.id] && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      На радио
                    </span>
                  )}
                </div>
                {track.error && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-danger-600 flex-1 min-w-0">
                      Error: {track.error}
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
                      className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
                    >
                      {clearingErrorId === track.id ? "…" : "Сбросить ошибку"}
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
