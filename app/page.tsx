"use client";

import { useState, useEffect } from "react";
import DownloadTrack from "./components/DownloadTrack";
import TrackPlayer from "./components/TrackPlayer";
import MetadataEditor from "./components/MetadataEditor";
import FtpUploader from "./components/FtpUploader";
import TrackStatusBadge from "./components/shared/TrackStatusBadge";
import { Track } from "@/types/track";

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTab, setActiveTab] = useState("download");

  useEffect(() => {
    // Load tracks from server
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      const response = await fetch("/api/tracks");
      if (response.ok) {
        const tracksData = await response.json();
        setTracks(tracksData);
      }
    } catch (error) {
      console.error("Error fetching tracks:", error);
    }
  };

  const tabs = [
    { id: "download", label: "Download Tracks", component: DownloadTrack },
    { id: "listen", label: "Listen & Review", component: TrackPlayer },
    { id: "metadata", label: "Edit Metadata", component: MetadataEditor },
    { id: "upload", label: "FTP Upload", component: FtpUploader },
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
                  <p className="text-xs text-danger-600 mt-1">
                    Error: {track.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
