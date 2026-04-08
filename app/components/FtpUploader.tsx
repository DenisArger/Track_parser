"use client";

import { useState, useEffect } from "react";
import { Track, FtpConfig } from "@/types/track";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { useI18n } from "./I18nProvider";
import Spinner from "./Spinner";

interface FtpUploaderProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

export default function FtpUploader({
  onTracksUpdate,
  tracks,
}: FtpUploaderProps) {
  const { t } = useI18n();
  const hiddenStorageKey = "ftpHiddenTrackIds";
  const [ftpConfig, setFtpConfig] = useState<FtpConfig>({
    host: "",
    port: 21,
    user: "",
    password: "",
    secure: false,
    remotePath: "",
  });
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [hiddenTrackIds, setHiddenTrackIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const loadFtpConfig = async () => {
      try {
        const response = await fetch("/api/ftp-config");
        if (response.ok) {
          const config = await response.json();
          setFtpConfig(config);
        }
      } catch (error) {
        console.error("Failed to load FTP config:", error);
      } finally {
        setIsConfigLoading(false);
      }
    };

    loadFtpConfig();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(hiddenStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setHiddenTrackIds(parsed);
      }
    } catch {
      // Ignore storage errors in environments without localStorage access.
    }
  }, [hiddenStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(hiddenTrackIds));
    } catch {
      // Ignore storage errors in environments without localStorage access.
    }
  }, [hiddenStorageKey, hiddenTrackIds]);

  useEffect(() => {
    if (Object.keys(hiddenTrackIds).length === 0) return;
    const knownIds = new Set(tracks.map((t) => t.id));
    let changed = false;
    const next = { ...hiddenTrackIds };
    for (const id of Object.keys(next)) {
      if (!knownIds.has(id)) {
        delete next[id];
        changed = true;
      }
    }
    if (changed) setHiddenTrackIds(next);
  }, [tracks, hiddenTrackIds]);

  const processedTracks = tracks.filter(
    (track) =>
      (track.status === "ready_for_upload" ||
        track.status === "reviewed_approved") &&
      track.processedPath &&
      !hiddenTrackIds[track.id],
  );

  const handleUploadTrack = async (trackId: string) => {
    setIsUploading(true);
    setError("");
    try {
      const response = await fetch("/api/upload-ftp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, ftpConfig }),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || t("ftp.errors.uploadFailed"));
      setHiddenTrackIds((prev) => ({ ...prev, [trackId]: true }));
      onTracksUpdate();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("ftp.errors.uploadFailed")));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFromQueue = (trackId: string) => {
    setHiddenTrackIds((prev) => ({ ...prev, [trackId]: true }));
  };

  const handleDeleteTrack = async (trackId: string) => {
    const confirmed = window.confirm(t("download.deleteConfirm"));
    if (!confirmed) return;
    setError("");
    try {
      const response = await fetch(`/api/tracks/${trackId}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || t("download.errors.deleteFailed"));
      setHiddenTrackIds((prev) => ({ ...prev, [trackId]: true }));
      onTracksUpdate();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("download.errors.deleteFailed")));
    }
  };

  const handleUploadAll = async () => {
    if (processedTracks.length === 0) {
      setError(t("ftp.errors.noTracks"));
      return;
    }

    setIsUploading(true);
    setError("");
    try {
      for (const track of processedTracks) {
        setUploadProgress((prev) => ({ ...prev, [track.id]: 0 }));
        try {
          const response = await fetch("/api/upload-ftp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackId: track.id, ftpConfig }),
          });
          const responseData = await response.json();
          if (!response.ok) {
            throw new Error(
              `${t("ftp.errors.uploadFailedFor")} ${track.metadata.title}: ${responseData.error || t("ftp.errors.uploadFailed")}`,
            );
          }
          setUploadProgress((prev) => ({ ...prev, [track.id]: 100 }));
          setHiddenTrackIds((prev) => ({ ...prev, [track.id]: true }));
        } catch (trackError) {
          setUploadProgress((prev) => ({ ...prev, [track.id]: 0 }));
          setError(
            `${t("ftp.errors.uploadFailedFor")} ${track.metadata.title}: ${
              trackError instanceof Error ? trackError.message : String(trackError)
            }`,
          );
        }
      }
      onTracksUpdate();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("ftp.errors.uploadFailed")));
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const handleTestConnection = async () => {
    try {
      const response = await fetch("/api/test-ftp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ftpConfig),
      });
      if (!response.ok) throw new Error(t("ftp.errors.connectionFailed"));
      alert(t("ftp.connectionSuccess"));
    } catch {
      setError(t("ftp.errors.connectionFailedHint"));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("ftp.title")}</h2>
        <p className="text-gray-600 mb-6">{t("ftp.description")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-1">
        <div>
          <div className="flex space-x-2">
            <button
              onClick={handleTestConnection}
              disabled={isConfigLoading || isUploading}
              className="btn btn-secondary disabled:opacity-50"
            >
              {isConfigLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Spinner label={t("ftp.uploadingFile")} />
                  <span>{t("ftp.uploadingFile")}</span>
                </span>
              ) : isUploading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Spinner label={t("ftp.uploading")} />
                  <span>{t("ftp.uploading")}</span>
                </span>
              ) : (
                t("ftp.testConnection")
              )}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">{t("ftp.uploadTitle")}</h3>
          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 mb-4">
              <p className="text-danger-700 text-sm">{error}</p>
            </div>
          )}
          {processedTracks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t("ftp.emptyTitle")}</p>
              <p className="text-sm mt-2">{t("ftp.emptyHint")}</p>
              <p className="text-xs mt-1 text-gray-400">
                {t("ftp.availableTracks", {
                  total: tracks.length,
                  ready: tracks.filter(
                    (t) =>
                      (t.status === "reviewed_approved" ||
                        t.status === "ready_for_upload") &&
                      t.processedPath,
                  ).length,
                })}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleUploadAll}
                disabled={isUploading || isConfigLoading || !ftpConfig.host || !ftpConfig.user}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {isUploading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner label={t("ftp.uploadAllLoading")} />
                    <span>{t("ftp.uploadAllLoading")}</span>
                  </span>
                ) : (
                  t("ftp.uploadAll", { count: processedTracks.length })
                )}
              </button>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {processedTracks.map((track) => (
                  <div key={track.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-[260px] shrink-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {track.metadata.title}
                        </h4>
                        <p className="text-sm text-gray-600">{track.metadata.artist}</p>
                      </div>
                      <audio
                        controls
                        className="audio-light flex-1 min-w-[240px]"
                        src={`/api/audio/${track.id}?processed=true`}
                      />
                      <div className="flex items-center space-x-2 shrink-0">
                        {uploadProgress[track.id] !== undefined && (
                          <span className="text-sm text-gray-600">
                            {uploadProgress[track.id]}%
                          </span>
                        )}
                        <button
                          onClick={() => handleUploadTrack(track.id)}
                          disabled={isUploading || isConfigLoading}
                          className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                          {isUploading ? (
                            <span className="inline-flex items-center justify-center gap-2">
                              <Spinner label={t("ftp.uploading")} />
                              <span>{t("ftp.uploading")}</span>
                            </span>
                          ) : (
                            t("ftp.upload")
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveFromQueue(track.id)}
                          disabled={isUploading || isConfigLoading}
                          className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                          {t("ftp.remove")}
                        </button>
                        <button
                          onClick={() => handleDeleteTrack(track.id)}
                          disabled={isUploading || isConfigLoading}
                          className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                          {t("download.delete")}
                        </button>
                      </div>
                    </div>
                    {uploadProgress[track.id] !== undefined &&
                      uploadProgress[track.id] < 100 && (
                        <div className="progress-bar mt-2">
                          <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress[track.id]}%` }}
                          />
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
