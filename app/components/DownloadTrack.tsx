"use client";

import { useState } from "react";
import { Track } from "@/types/track";

interface DownloadTrackProps {
  onTracksUpdate: () => void;
  tracks: Track[];
}

export default function DownloadTrack({
  onTracksUpdate,
  tracks,
}: DownloadTrackProps) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<"youtube" | "yandex">("youtube");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setIsDownloading(true);
    setError("");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, source }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Download failed");
      }

      const result = await response.json();
      console.log("Download successful:", result);

      // Clear form
      setUrl("");
      onTracksUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError("");
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSource(e.target.value as "youtube" | "yandex");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Download Tracks</h2>
        <p className="text-gray-600 mb-6">
          Enter a URL from YouTube or Yandex Music to download tracks for
          processing.
        </p>
      </div>

      <div className="space-y-4">
        {/* Source Selection */}
        <div>
          <label
            htmlFor="source"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Source Platform
          </label>
          <select
            id="source"
            value={source}
            onChange={handleSourceChange}
            className="input"
          >
            <option value="youtube">YouTube</option>
            <option value="yandex">Yandex Music</option>
          </select>
        </div>

        {/* URL Input */}
        <div>
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Track URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={handleUrlChange}
            placeholder={`Enter ${
              source === "youtube" ? "YouTube" : "Yandex Music"
            } URL`}
            className="input"
            disabled={isDownloading}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
            <p className="text-danger-700 text-sm">{error}</p>
          </div>
        )}

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading || !url.trim()}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Downloading...</span>
            </div>
          ) : (
            "Download Track"
          )}
        </button>
      </div>

      {/* Downloading Tracks */}
      {tracks.filter((track) => track.status === "downloading").length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Downloading Tracks</h3>
          <div className="space-y-3">
            {tracks
              .filter((track) => track.status === "downloading")
              .map((track) => (
                <div
                  key={track.id}
                  className="border rounded-lg p-4 bg-blue-50"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">
                      {track.metadata.title}
                    </span>
                    <span className="text-sm text-gray-600">
                      {track.downloadProgress?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${track.downloadProgress || 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recently Downloaded Tracks */}
      {tracks.filter((track) => track.status === "downloaded").length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Recently Downloaded</h3>
          <div className="space-y-2">
            {tracks
              .filter((track) => track.status === "downloaded")
              .slice(0, 5)
              .map((track) => (
                <div
                  key={track.id}
                  className="flex justify-between items-center p-3 bg-green-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {track.metadata.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {track.metadata.artist}
                    </p>
                  </div>
                  <span className="text-sm text-green-600 font-medium">
                    Ready for processing
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
