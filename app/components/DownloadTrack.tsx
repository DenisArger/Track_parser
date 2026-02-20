"use client";

import { useState, useRef } from "react";
import { Track } from "@/types/track";
import {
  getDownloadingTracks,
  getDownloadedTracks,
} from "@/lib/utils/trackFilters";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { downloadTrackAction } from "@/lib/actions/trackActions";
import { useI18n } from "./I18nProvider";

interface DownloadTrackProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

type ErrorDiagnostics = {
  operation: string;
  timestamp: string;
  urlInput?: string;
  source?: "youtube" | "youtube-music" | "auto";
  httpStatus?: number;
  endpoint?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  online?: boolean;
  errorName?: string;
  errorMessage?: string;
  stack?: string;
};

export default function DownloadTrack({
  onTracksUpdate,
  tracks,
}: DownloadTrackProps) {
  const { t } = useI18n();
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
  const [errorDiagnostics, setErrorDiagnostics] = useState<ErrorDiagnostics | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const visibleDownloadingTracks = getDownloadingTracks(tracks).filter(
    (track) => !hiddenTrackIds[track.id]
  );
  const visibleDownloadedTracks = getDownloadedTracks(tracks).filter(
    (track) => !hiddenTrackIds[track.id]
  );
  const placeholderBySource = {
    auto: t("download.placeholder.auto"),
    youtube: t("download.placeholder.youtube"),
    "youtube-music": t("download.placeholder.youtubeMusic"),
  } as const;

  const setDetailedError = (
    userMessage: string,
    operation: string,
    err?: unknown,
    extras: Partial<ErrorDiagnostics> = {}
  ) => {
    setError(userMessage);
    const errorName = err instanceof Error ? err.name : typeof err;
    const errorMessage = err instanceof Error ? err.message : String(err ?? "");
    const stack =
      err instanceof Error && err.stack
        ? err.stack.split("\n").slice(0, 8).join("\n")
        : undefined;

    setErrorDiagnostics({
      operation,
      timestamp: new Date().toISOString(),
      urlInput: url || undefined,
      source,
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      errorName,
      errorMessage,
      stack,
      ...extras,
    });

    console.error("[DownloadTrack] UI error", {
      userMessage,
      operation,
      errorName,
      errorMessage,
      extras,
    });
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      setDetailedError(t("download.errors.invalidUrl"), "validate-download-url");
      return;
    }

    setIsDownloading(true);
    setError("");
    setErrorDiagnostics(null);

    try {
      const sourceParam = source === "auto" ? undefined : source;
      const result = await downloadTrackAction(url, sourceParam);

      if (!result.ok) {
        setDetailedError(result.error, "download-track-action-returned-error");
        return;
      }

      console.warn("Download successful:", result.track);
      setUrl("");
      onTracksUpdate();
    } catch (err) {
      setDetailedError(
        getUserFacingErrorMessage(err, t("download.errors.downloadFailed")),
        "download-track-action-threw",
        err
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError("");
    setErrorDiagnostics(null);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSource(e.target.value as "youtube" | "youtube-music" | "auto");
  };

  const handleLocalFileUpload = async (file: File) => {
    setIsUploadingLocal(true);
    setError("");
    setErrorDiagnostics(null);

    try {
      const signResponse = await fetch("/api/upload-local/signed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "audio/mpeg",
        }),
      });

      const signContentType = signResponse.headers.get("content-type") || "";
      const signText = await signResponse.text();
      let signResult:
        | {
            error?: string;
            signedUrl?: string;
            trackId?: string;
          }
        | null = null;

      if (signContentType.includes("application/json")) {
        try {
          signResult = JSON.parse(signText) as {
            error?: string;
            signedUrl?: string;
            trackId?: string;
          };
        } catch {
          signResult = null;
        }
      }

      if (!signResponse.ok) {
        const rawMessage =
          signResult?.error || signText || t("download.errors.localUploadFailed");
        const lowered = rawMessage.toLowerCase();
        const isTooLarge =
          signResponse.status === 413 ||
          lowered.includes("request entity too large") ||
          lowered.includes("payload too large");

        throw new Error(
          isTooLarge
            ? t("download.errors.fileTooLarge")
            : `${rawMessage} (HTTP ${signResponse.status}, /api/upload-local/signed)`
        );
      }

      const signedUrl = signResult?.signedUrl;
      const trackId = signResult?.trackId;
      if (!signedUrl || !trackId) {
        throw new Error(t("download.errors.signedUrlMissing"));
      }

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "audio/mpeg",
          "x-upsert": "true",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const uploadText = await uploadResponse.text();
        throw new Error(
          `${uploadText || t("download.errors.storageUploadFailed")} (HTTP ${
            uploadResponse.status
          }, signed upload)`
        );
      }

      const completeResponse = await fetch("/api/upload-local/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackId }),
      });

      const completeContentType =
        completeResponse.headers.get("content-type") || "";
      const completeText = await completeResponse.text();
      let completeResult: { error?: string } | null = null;
      if (completeContentType.includes("application/json")) {
        try {
          completeResult = JSON.parse(completeText) as { error?: string };
        } catch {
          completeResult = null;
        }
      }

      if (!completeResponse.ok) {
        const rawMessage =
          completeResult?.error || completeText || t("download.errors.localUploadFailed");
        const lowered = rawMessage.toLowerCase();
        const isTooLarge =
          completeResponse.status === 413 ||
          lowered.includes("request entity too large") ||
          lowered.includes("payload too large");

        throw new Error(
          isTooLarge
            ? t("download.errors.fileTooLarge")
            : `${rawMessage} (HTTP ${completeResponse.status}, /api/upload-local/complete)`
        );
      }

      onTracksUpdate();
    } catch (err) {
      setDetailedError(
        getUserFacingErrorMessage(err, t("download.errors.localUploadFailed")),
        "local-file-upload",
        err,
        {
          fileName: file.name,
          fileType: file.type || "audio/mpeg",
          fileSize: file.size,
        }
      );
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
      setDetailedError(t("download.errors.trackIdRequired"), "validate-track-id-for-delete");
      return;
    }
    const confirmed = window.confirm(
      t("download.deleteConfirm")
    );
    if (!confirmed) return;

    setDeletingIds((prev) => ({ ...prev, [trackId]: true }));
    setError("");
    setErrorDiagnostics(null);
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
        throw new Error(
          `${result?.error || "Delete failed"} (HTTP ${response.status}, /api/tracks/${trackId})`
        );
      }
      onTracksUpdate();
    } catch (err) {
      setDetailedError(
        getUserFacingErrorMessage(err, t("download.errors.deleteFailed")),
        "delete-track",
        err,
        { endpoint: `/api/tracks/${trackId}` }
      );
    } finally {
      setDeletingIds((prev) => ({ ...prev, [trackId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("download.title")}</h2>
        <p className="text-gray-600 mb-6">
          {t("download.description")}
        </p>
      </div>

      <div className="space-y-4">
        {/* Local File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("download.localFile")}
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
            <p className="text-sm text-gray-700">{t("download.dragDrop")}</p>
            <p className="text-xs text-gray-500 mt-2">
              {t("download.supportedFormat")}
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
            <p className="text-sm text-gray-600 mt-2">{t("download.uploadingFile")}</p>
          )}
        </div>

        {/* Source Selection */}
        <div>
          <label
            htmlFor="source"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("download.sourcePlatform")}
          </label>
          <select
            id="source"
            value={source}
            onChange={handleSourceChange}
            className="input"
            disabled={isDownloading || isUploadingLocal}
          >
            <option value="auto">{t("download.source.auto")}</option>
            <option value="youtube">{t("download.source.youtube")}</option>
            <option value="youtube-music">{t("download.source.youtubeMusic")}</option>
          </select>
        </div>

        {/* URL Input */}
        <div>
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("download.trackUrl")}
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={handleUrlChange}
            placeholder={placeholderBySource[source]}
            className="input"
            disabled={isDownloading || isUploadingLocal}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
            <p className="text-danger-700 text-sm">{error}</p>
            {errorDiagnostics && (
              <div className="mt-3 p-3 rounded border border-danger-200 bg-white">
                <p className="text-xs font-semibold text-gray-700 mb-1">Debug details</p>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">
{`operation: ${errorDiagnostics.operation}
time: ${errorDiagnostics.timestamp}
urlInput: ${errorDiagnostics.urlInput || "-"}
source: ${errorDiagnostics.source || "-"}
endpoint: ${errorDiagnostics.endpoint || "-"}
httpStatus: ${errorDiagnostics.httpStatus ?? "-"}
fileName: ${errorDiagnostics.fileName || "-"}
fileType: ${errorDiagnostics.fileType || "-"}
fileSize: ${errorDiagnostics.fileSize ?? "-"}
online: ${errorDiagnostics.online === undefined ? "-" : String(errorDiagnostics.online)}
errorName: ${errorDiagnostics.errorName || "-"}
errorMessage: ${errorDiagnostics.errorMessage || "-"}
stack:
${errorDiagnostics.stack || "-"}`}
                </pre>
              </div>
            )}
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
              <span>{t("download.downloading")}</span>
            </div>
          ) : (
            t("download.downloadAction")
          )}
        </button>
      </div>

      {/* Downloading Tracks */}
      {visibleDownloadingTracks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">{t("download.downloadingTitle")}</h3>
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
                    {deletingIds[track.id] ? t("download.deleting") : t("download.delete")}
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
          <h3 className="text-lg font-medium mb-3">{t("download.recentlyDownloaded")}</h3>
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
                          {t("download.trimmedBadge")}
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
                        ? t("download.processed")
                        : t("download.readyForProcessing")}
                    </span>
                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      disabled={!!deletingIds[track.id]}
                      className="btn btn-secondary text-sm disabled:opacity-50"
                    >
                      {deletingIds[track.id] ? t("download.deleting") : t("download.delete")}
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
