"use client";

import { useState, useRef } from "react";
import { Track } from "@/types/track";
import TrackList from "./shared/TrackList";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { formatTime } from "@/lib/utils/timeFormatter";
import TrackTrimmer from "./TrackTrimmer";
import TrimDetails from "./TrimDetails";
import { useI18n } from "./I18nProvider";

interface TrackPlayerProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

export default function TrackPlayer({
  onTracksUpdate,
  tracks,
  onRadioMap,
}: TrackPlayerProps) {
  const { t } = useI18n();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [showTrimDetails, setShowTrimDetails] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const downloadedTracks = tracks.filter(
    (track) => track.status === "downloaded" || track.status === "trimmed"
  );

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);

    // Reset audio element
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  };

  const handleAudioError = (error: unknown) => {
    console.error("Audio error:", error);
    alert(t("player.audioError"));
  };

  const handleAccept = async () => {
    if (!currentTrack) return;

    console.warn("Accepting track:", currentTrack.id);
    setIsAccepting(true);

    try {
      const { processTrackAction } = await import("@/lib/actions/trackActions");
      const result = await processTrackAction(
        currentTrack.id,
        currentTrack.metadata
      );
      console.warn("Process track success:", result);

      onTracksUpdate();
      setCurrentTrack(null);
    } catch (error) {
      console.error("Error processing track:", error);
      alert(
        `${t("player.processError")}: ${getUserFacingErrorMessage(
          error,
          t("player.unknownError")
        )}`
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!currentTrack) return;

    console.warn("Rejecting track:", currentTrack.id);
    setIsRejecting(true);

    try {
      const { rejectTrackAction } = await import("@/lib/actions/trackActions");
      await rejectTrackAction(currentTrack.id);
      console.warn("Reject track success");

      onTracksUpdate();
      setCurrentTrack(null);
    } catch (error) {
      console.error("Error rejecting track:", error);
      alert(
        `${t("player.rejectError")}: ${getUserFacingErrorMessage(
          error,
          t("player.unknownError")
        )}`
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // Функция handleTrim больше не нужна, так как обрезка происходит напрямую в TrackTrimmer

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("player.title")}</h2>
        <p className="text-gray-600 mb-6">
          {t("player.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track List */}
        <div>
          <h3 className="text-lg font-medium mb-3">{t("player.downloadedTitle")}</h3>
          <TrackList
            tracks={downloadedTracks}
            onTrackSelect={handleTrackSelect}
            selectedTrackId={currentTrack?.id}
            showDuration={true}
            onRadioMap={onRadioMap}
            emptyMessage={t("player.emptyMessage")}
            emptySubMessage={t("player.emptySubMessage")}
          />
        </div>

        {/* Audio Player */}
        <div>
          <h3 className="text-lg font-medium mb-3">{t("player.audioPlayer")}</h3>
          {currentTrack ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-1">
                  {currentTrack.metadata.title}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  {currentTrack.metadata.artist}
                </p>
                {currentTrack.metadata.isTrimmed && (
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {t("player.trimmedBadge")}
                    </span>
                    {currentTrack.metadata.trimSettings && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-600">
                          {t("player.trimFragment")}{" "}
                          {formatTime(
                            currentTrack.metadata.trimSettings.startTime
                          )}{" "}
                          -{" "}
                          {formatTime(
                            currentTrack.metadata.trimSettings.endTime ||
                              currentTrack.metadata.trimSettings.startTime +
                                (currentTrack.metadata.trimSettings
                                  .maxDuration || 360)
                          )}
                        </span>
                        <button
                          onClick={() => setShowTrimDetails(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {t("player.trimDetails")}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <audio
                  ref={audioRef}
                  controls
                  className="audio-light w-full"
                  src={
                    currentTrack.status === "trimmed"
                      ? `/api/audio/${currentTrack.id}?trimmed=true`
                      : `/api/audio/${currentTrack.id}`
                  }
                  onError={handleAudioError}
                  preload="metadata"
                />

                {/* Action Buttons */}
                <div className="flex space-x-3 mt-4">
                  {currentTrack.status === "downloaded" ? (
                    <>
                      <button
                        onClick={() => setShowTrimmer(true)}
                        disabled={isAccepting || isRejecting}
                        className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("player.configureTrim")}
                      </button>
                      <button
                        onClick={handleAccept}
                        disabled={isAccepting || isRejecting}
                        className="btn btn-success flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAccepting ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            {t("player.processing")}
                          </div>
                        ) : (
                          t("player.acceptTrack")
                        )}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={isAccepting || isRejecting}
                        className="btn btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRejecting ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            {t("player.rejecting")}
                          </div>
                        ) : (
                          t("player.rejectTrack")
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowTrimmer(true)}
                        disabled={isAccepting || isRejecting}
                        className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("player.editTrim")}
                      </button>
                      <button
                        onClick={handleAccept}
                        disabled={isAccepting || isRejecting}
                        className="btn btn-success flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAccepting ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            {t("player.processing")}
                          </div>
                        ) : (
                          t("player.analyzeTrack")
                        )}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={isAccepting || isRejecting}
                        className="btn btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRejecting ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            {t("player.rejecting")}
                          </div>
                        ) : (
                          t("player.rejectTrack")
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>{t("player.selectPrompt")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Track Trimmer Modal */}
      {showTrimmer && currentTrack && (
        <TrackTrimmer
          track={currentTrack}
          onCancel={() => {
            setShowTrimmer(false);
            onTracksUpdate(); // Обновляем список треков после закрытия
          }}
        />
      )}

      {/* Trim Details Modal */}
      {showTrimDetails && currentTrack?.metadata.trimSettings && (
        <TrimDetails
          trimSettings={currentTrack.metadata.trimSettings}
          onClose={() => setShowTrimDetails(false)}
        />
      )}
    </div>
  );
}
