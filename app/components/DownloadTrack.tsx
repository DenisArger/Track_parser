"use client";

import { useState } from "react";
import { Track } from "@/types/track";
import {
  getDownloadingTracks,
  getDownloadedTracks,
} from "@/lib/utils/trackFilters";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { downloadTrackAction } from "@/lib/actions/trackActions";

interface DownloadTrackProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

export default function DownloadTrack({
  onTracksUpdate,
  tracks,
}: DownloadTrackProps) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<
    "youtube" | "youtube-music" | "yandex" | "auto"
  >("auto");
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
      const sourceParam = source === "auto" ? undefined : source;
      const result = await downloadTrackAction(url, sourceParam);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      console.log("Download successful:", result.track);
      setUrl("");
      onTracksUpdate();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Download failed"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError("");
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSource(
      e.target.value as "youtube" | "youtube-music" | "yandex" | "auto"
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Download Tracks</h2>
        <p className="text-gray-600 mb-6">
          Enter a URL from YouTube, YouTube Music, or Yandex Music to download
          tracks for processing.
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
            <option value="auto">Auto-detect</option>
            <option value="youtube">YouTube</option>
            <option value="youtube-music">YouTube Music</option>
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
              source === "auto"
                ? "YouTube, YouTube Music, or Yandex Music"
                : source === "youtube"
                ? "YouTube"
                : source === "youtube-music"
                ? "YouTube Music"
                : "Yandex Music"
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
      {getDownloadingTracks(tracks).length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Downloading Tracks</h3>
          <div className="space-y-3">
            {getDownloadingTracks(tracks).map((track) => (
              <div key={track.id} className="border rounded-lg p-4 bg-blue-50">
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
      {getDownloadedTracks(tracks).length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Recently Downloaded</h3>
          <div className="space-y-2">
            {getDownloadedTracks(tracks)
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
                    {track.metadata.isTrimmed && (
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <svg
                            className="w-2.5 h-2.5 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Обрезан
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-green-600 font-medium">
                    {track.metadata.isTrimmed
                      ? "Обработан"
                      : "Ready for processing"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
