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

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTab, setActiveTab] = useState("download");
  const [clearingErrorId, setClearingErrorId] = useState<string | null>(null);

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

  const fetchTracks = async () => {
    try {
      const tracksData = await getAllTracks();
      setTracks(tracksData);
    } catch (error) {
      console.error("Error fetching tracks:", error);
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
        <ActiveComponent onTracksUpdate={fetchTracks} tracks={tracks} />
      </div>

      {/* Tracks Overview */}
      {tracks.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Tracks Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((track) => (
              <div key={track.id} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 truncate">
                  {track.metadata.title}
                </h4>
                <p className="text-sm text-gray-600">{track.metadata.artist}</p>
                <div className="mt-2">
                  <TrackStatusBadge status={track.status} />
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
