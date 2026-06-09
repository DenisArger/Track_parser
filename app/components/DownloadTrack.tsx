"use client";

import { useState, useRef } from "react";
import { Track } from "@/types/track";
import {
  getDownloadingTracks,
  getDownloadedTracks,
} from "@/lib/utils/trackFilters";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import {
  formatErrorReportForCopy,
  reportClientError,
} from "@/lib/utils/errorReporter";
import { downloadTrackAction } from "@/lib/actions/trackActions";
import { useI18n } from "./I18nProvider";
import Spinner from "./Spinner";
import ErrorDetails from "./ErrorDetails";

interface DownloadTrackProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

type ErrorDiagnostics = {
  operation: string;
  stage?: "sign-request" | "signed-upload" | "complete-request" | "unknown";
  timestamp: string;
  urlInput?: string;
  source?: "youtube" | "youtube-music" | "auto";
  httpStatus?: number;
  endpoint?: string;
  signedUrlHost?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  online?: boolean;
  userAgent?: string;
  isLikelyCors?: boolean;
  isLikelyBrowserBlock?: boolean;
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
    "auto",
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [hiddenTrackIds, setHiddenTrackIds] = useState<Record<string, boolean>>(
    {},
  );
  const [error, setError] = useState("");
  const [errorDiagnostics, setErrorDiagnostics] =
    useState<ErrorDiagnostics | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleDownloadingTracks = getDownloadingTracks(tracks).filter(
    (track) => !hiddenTrackIds[track.id],
  );
  const visibleDownloadedTracks = getDownloadedTracks(tracks).filter(
    (track) => !hiddenTrackIds[track.id],
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
    extras: Partial<ErrorDiagnostics> = {},
  ) => {
    setError(userMessage);
    const report = reportClientError(err ?? userMessage, {
      operation,
      component: "DownloadTrack",
      endpoint: extras.endpoint,
      stage: extras.stage,
      url: url || undefined,
      source,
      ...extras,
    });

    setErrorDetails(formatErrorReportForCopy(report));

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
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      errorName,
      errorMessage,
      stack,
      ...extras,
    });
  };

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  };

  const isPlaylistUrl = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes("list=") || lower.includes("/playlist");
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      setDetailedError(
        t("download.errors.invalidUrl"),
        "validate-download-url",
      );
      return;
    }

    if (isPlaylistUrl(url)) {
      setDetailedError(
        "Плейлисты не поддерживаются. Вставьте ссылку на один трек (watch?v=...).",
        "validate-download-url",
        undefined,
        { urlInput: url },
      );
      return;
    }

    setIsDownloading(true);
    setError("");
    setErrorDiagnostics(null);
    setErrorDetails(null);

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
        err,
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError("");
    setErrorDiagnostics(null);
    setErrorDetails(null);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSource(e.target.value as "youtube" | "youtube-music" | "auto");
  };

  const handleLocalFileUpload = async (file: File) => {
    setIsUploadingLocal(true);
    setError("");
    setErrorDiagnostics(null);
    setErrorDetails(null);
    let currentStage: ErrorDiagnostics["stage"] = "unknown";
    let currentEndpoint: string | undefined;
    let currentHttpStatus: number | undefined;
    let currentSignedUrlHost: string | undefined;

    const postJson = async (path: string, payload: unknown) => {
      const requestUrl =
        typeof window !== "undefined"
          ? new URL(path, window.location.origin).toString()
          : path;

      return fetch(requestUrl, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    try {
      currentStage = "sign-request";
      currentEndpoint = "/api/upload-local/signed";
      currentHttpStatus = undefined;
      let signResponse: Response;
      try {
        signResponse = await postJson("/api/upload-local/signed", {
          filename: file.name,
          contentType: file.type || "audio/mpeg",
        });
      } catch (requestError) {
        signResponse = await postJson("/api/upload-local/signed", {
          filename: file.name,
          contentType: file.type || "audio/mpeg",
        }).catch((retryError) => {
          throw retryError instanceof Error ? retryError : requestError;
        });
      }
      currentHttpStatus = signResponse.status;

      const signContentType = signResponse.headers.get("content-type") || "";
      const signText = await signResponse.text();
      let signResult: {
        error?: string;
        signedUrl?: string;
        trackId?: string;
      } | null = null;

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
          signResult?.error ||
          signText ||
          t("download.errors.localUploadFailed");
        const lowered = rawMessage.toLowerCase();
        const isTooLarge =
          signResponse.status === 413 ||
          lowered.includes("request entity too large") ||
          lowered.includes("payload too large");
        const isNetworkLike =
          signResponse.status === 0 ||
          lowered.includes("failed to fetch") ||
          lowered.includes("network error");

        throw new Error(
          isTooLarge
            ? t("download.errors.fileTooLarge")
            : isNetworkLike
              ? `${t("download.errors.localUploadFailed")} (POST /api/upload-local/signed)`
              : `${rawMessage} (HTTP ${signResponse.status}, /api/upload-local/signed)`,
        );
      }

      const signedUrl = signResult?.signedUrl;
      const trackId = signResult?.trackId;
      if (!signedUrl || !trackId) {
        throw new Error(t("download.errors.signedUrlMissing"));
      }
      currentStage = "signed-upload";
      currentEndpoint = signedUrl;
      currentHttpStatus = undefined;
      try {
        currentSignedUrlHost = new URL(signedUrl).host;
      } catch {
        currentSignedUrlHost = undefined;
      }

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "audio/mpeg",
        },
        body: file,
      });
      currentHttpStatus = uploadResponse.status;

      if (!uploadResponse.ok) {
        const uploadText = await uploadResponse.text();
        throw new Error(
          `${uploadText || t("download.errors.storageUploadFailed")} (HTTP ${
            uploadResponse.status
          }, signed upload)`,
        );
      }

      currentStage = "complete-request";
      currentEndpoint = "/api/upload-local/complete";
      currentHttpStatus = undefined;
      const completeResponse = await fetch("/api/upload-local/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackId }),
      });
      currentHttpStatus = completeResponse.status;

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
          completeResult?.error ||
          completeText ||
          t("download.errors.localUploadFailed");
        const lowered = rawMessage.toLowerCase();
        const isTooLarge =
          completeResponse.status === 413 ||
          lowered.includes("request entity too large") ||
          lowered.includes("payload too large");

        throw new Error(
          isTooLarge
            ? t("download.errors.fileTooLarge")
            : `${rawMessage} (HTTP ${completeResponse.status}, /api/upload-local/complete)`,
        );
      }

      onTracksUpdate();
      showToast(t("download.uploadSuccess"));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const likelyCorsOnSignedUpload =
        errorMessage.toLowerCase().includes("failed to fetch") &&
        currentStage === "signed-upload";
      setDetailedError(
        likelyCorsOnSignedUpload
          ? `${getUserFacingErrorMessage(
              err,
              t("download.errors.localUploadFailed"),
            )}. Вероятно блокировка запроса браузером/расширением (signed upload URL Supabase Storage).`
          : getUserFacingErrorMessage(
              err,
              t("download.errors.localUploadFailed"),
            ),
        "local-file-upload",
        err,
        {
          stage: currentStage,
          endpoint: currentEndpoint,
          httpStatus: currentHttpStatus,
          signedUrlHost: currentSignedUrlHost,
          isLikelyCors: likelyCorsOnSignedUpload,
          isLikelyBrowserBlock: likelyCorsOnSignedUpload,
          fileName: file.name,
          fileType: file.type || "audio/mpeg",
          fileSize: file.size,
        },
      );
    } finally {
      setIsUploadingLocal(false);
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
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
      setDetailedError(
        t("download.errors.trackIdRequired"),
        "validate-track-id-for-delete",
      );
      return;
    }
    const confirmed = window.confirm(t("download.deleteConfirm"));
    if (!confirmed) return;

    setDeletingIds((prev) => ({ ...prev, [trackId]: true }));
    setError("");
    setErrorDiagnostics(null);
    setErrorDetails(null);
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
          `${result?.error || "Delete failed"} (HTTP ${response.status}, /api/tracks/${trackId})`,
        );
      }
      onTracksUpdate();
    } catch (err) {
      setDetailedError(
        getUserFacingErrorMessage(err, t("download.errors.deleteFailed")),
        "delete-track",
        err,
        { endpoint: `/api/tracks/${trackId}` },
      );
    } finally {
      setDeletingIds((prev) => ({ ...prev, [trackId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg shadow-emerald-950/10 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-100"
        >
          {toastMessage}
        </div>
      ) : null}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("download.title")}</h2>
        <p className="text-gray-600 mb-6">{t("download.description")}</p>
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
            <p className="text-sm text-gray-600 mt-2">
              {t("download.uploadingFile")}
            </p>
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
            <option value="youtube-music">
              {t("download.source.youtubeMusic")}
            </option>
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
          <div className="space-y-3">
            {errorDiagnostics?.isLikelyBrowserBlock && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Похоже, браузер блокирует upload-запрос к Supabase. Проверьте
                расширения/блокировщики, отключите Protect и повторите в режиме
                инкогнито (Chrome) без расширений.
              </div>
            )}
            <ErrorDetails
              title={t("download.errorDetailsTitle")}
              message={error}
              details={errorDetails ?? undefined}
              copyLabel={t("download.copyDebugDetails")}
              copySuccessLabel={t("download.copyDebugDetailsSuccess")}
              copyErrorLabel={t("download.copyDebugDetailsError")}
            />
          </div>
        )}

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading || isUploadingLocal || !url.trim()}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner label={t("download.downloading")} />
              <span>{t("download.downloading")}</span>
            </span>
          ) : (
            t("download.downloadAction")
          )}
        </button>
      </div>

      {/* Downloading Tracks */}
      {visibleDownloadingTracks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">
            {t("download.downloadingTitle")}
          </h3>
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
                    {deletingIds[track.id]
                      ? t("download.deleting")
                      : t("download.delete")}
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
          <h3 className="text-lg font-medium mb-3">
            {t("download.recentlyDownloaded")}
          </h3>
          <div className="space-y-2">
            {visibleDownloadedTracks.slice(0, 5).map((track) => (
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
                </div>
                <audio
                  controls
                  className="audio-light w-full h-8"
                  src={`/api/audio/${track.id}`}
                />
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-green-600 font-medium">
                    {t("download.readyForProcessing")}
                  </span>
                  <button
                    onClick={() => handleDeleteTrack(track.id)}
                    disabled={!!deletingIds[track.id]}
                    className="btn btn-secondary text-sm disabled:opacity-50"
                  >
                    {deletingIds[track.id]
                      ? t("download.deleting")
                      : t("download.delete")}
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
