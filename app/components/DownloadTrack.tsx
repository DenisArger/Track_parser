"use client";

import { useState, useRef } from "react";
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
  const [source, setSource] = useState<"youtube" | "youtube-music" | "auto">(
    "auto"
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [hiddenTrackIds, setHiddenTrackIds] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const visibleDownloadingTracks = getDownloadingTracks(tracks).filter(
    (track) => !hiddenTrackIds[track.id]
  );
  const visibleDownloadedTracks = getDownloadedTracks(tracks).filter(
    (track) => !hiddenTrackIds[track.id]
  );

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

      console.warn("Download successful:", result.track);
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
    setSource(e.target.value as "youtube" | "youtube-music" | "auto");
  };

  const handleLocalFileUpload = async (file: File) => {
    setIsUploadingLocal(true);
    setError("");

    try {
      const response = await fetch("/api/upload-local", {
        method: "POST",
        headers: {
          "x-file-name-encoded": encodeURIComponent(file.name),
          "x-file-type": file.type || "audio/mpeg",
        },
        body: file,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Local upload failed");
      }

      onTracksUpdate();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Local upload failed"));
    } finally {
      setIsUploadingLocal(false);
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleLocalFileUpload(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await handleLocalFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!trackId || trackId === "undefined" || trackId === "null") {
      setError("Track ID is required");
      return;
    }
    const confirmed = window.confirm(
      "Удалить трек? Файл будет удалён из базы и Storage."
    );
    if (!confirmed) return;

    setDeletingIds((prev) => ({ ...prev, [trackId]: true }));
    setError("");
    try {
      setHiddenTrackIds((prev) => ({ ...prev, [trackId]: true }));
      const response = await fetch(`/api/tracks/${trackId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        setHiddenTrackIds((prev) => {
          const next = { ...prev };
          delete next[trackId];
          return next;
        });
        throw new Error(result?.error || "Delete failed");
      }
      onTracksUpdate();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Delete failed"));
    } finally {
      setDeletingIds((prev) => ({ ...prev, [trackId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Download Tracks</h2>
        <p className="text-gray-600 mb-6">
          Enter a URL from YouTube or YouTube Music to download tracks for
          processing.
        </p>
      </div>

      <div className="space-y-4">
        {/* Local File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Local File
          </label>
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
              isDragActive
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 bg-gray-50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleBrowseClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBrowseClick();
              }
            }}
          >
            <p className="text-sm text-gray-700">
              Drag & drop an MP3 file here, or click to choose a file
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Supported format: MP3
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isDownloading || isUploadingLocal}
          />
          {isUploadingLocal && (
            <p className="text-sm text-gray-600 mt-2">Uploading file...</p>
          )}
        </div>

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
            disabled={isDownloading || isUploadingLocal}
          >
            <option value="auto">Auto-detect</option>
            <option value="youtube">YouTube</option>
            <option value="youtube-music">YouTube Music</option>
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
                ? "YouTube or YouTube Music"
                : source === "youtube"
                ? "YouTube"
                : source === "youtube-music"
                ? "YouTube Music"
                : "YouTube"
            } URL`}
            className="input"
            disabled={isDownloading || isUploadingLocal}
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
          disabled={isDownloading || isUploadingLocal || !url.trim()}
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
      {visibleDownloadingTracks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Downloading Tracks</h3>
          <div className="space-y-3">
            {visibleDownloadingTracks.map((track) => (
              <div key={track.id} className="border rounded-lg p-4 bg-blue-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">
                    {track.metadata.title}
                  </span>
                  <span className="text-sm text-gray-600">
                    {track.downloadProgress?.toFixed(1)}%
                  </span>
                </div>
                <audio
                  controls
                  className="audio-light w-full mb-2"
                  src={`/api/audio/${track.id}`}
                />
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${track.downloadProgress || 0}%` }}
                  ></div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleDeleteTrack(track.id)}
                    disabled={!!deletingIds[track.id]}
                    className="btn btn-secondary text-sm disabled:opacity-50"
                  >
                    {deletingIds[track.id] ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Downloaded Tracks */}
      {visibleDownloadedTracks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Recently Downloaded</h3>
          <div className="space-y-2">
            {visibleDownloadedTracks
              .slice(0, 5)
              .map((track) => (
                <div
                  key={track.id}
                  className="grid items-center gap-3 p-2 bg-green-50 rounded-lg grid-cols-[220px_1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {track.metadata.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {track.metadata.artist}
                    </p>
                    {track.metadata.isTrimmed && (
                      <div className="flex items-center space-x-1 mt-0.5">
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
                  <audio
                    controls
                    className="audio-light w-full h-8"
                    src={
                      track.status === "trimmed"
                        ? `/api/audio/${track.id}?trimmed=true`
                        : `/api/audio/${track.id}`
                    }
                  />
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-green-600 font-medium">
                      {track.metadata.isTrimmed
                        ? "РћР±СЂР°Р±РѕС‚Р°РЅ"
                        : "Ready for processing"}
                    </span>
                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      disabled={!!deletingIds[track.id]}
                      className="btn btn-secondary text-sm disabled:opacity-50"
                    >
                      {deletingIds[track.id] ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

