"use client";

import { useState, useRef } from "react";
import { Track, TrimSettings } from "@/types/track";
import TrackTrimmer from "./TrackTrimmer";
import TrimDetails from "./TrimDetails";

interface TrackPlayerProps {
  onTracksUpdate: () => void;
  tracks: Track[];
}

export default function TrackPlayer({
  onTracksUpdate,
  tracks,
}: TrackPlayerProps) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [showTrimDetails, setShowTrimDetails] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const downloadedTracks = tracks.filter(
    (track) => track.status === "downloaded"
  );

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(false);
    setCurrentTime(0);

    // Reset audio element
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Audio playback error:", error);
      alert("Error playing audio. Please check the console for details.");
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioError = (error: any) => {
    console.error("Audio error:", error);
    alert("Error loading audio file. Please check the console for details.");
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleAccept = async () => {
    if (!currentTrack) return;

    console.log("Accepting track:", currentTrack.id);
    setIsAccepting(true);

    try {
      const response = await fetch("/api/process-track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId: currentTrack.id,
          metadata: currentTrack.metadata,
        }),
      });

      console.log("Process track response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Process track error data:", errorData);
        throw new Error(
          `Failed to process track: ${errorData.error || response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Process track success:", result);

      onTracksUpdate();
      setCurrentTrack(null);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error processing track:", error);
      alert(
        `Error processing track: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!currentTrack) return;

    console.log("Rejecting track:", currentTrack.id);
    setIsRejecting(true);

    try {
      const response = await fetch("/api/reject-track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackId: currentTrack.id }),
      });

      console.log("Reject track response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Reject track error data:", errorData);
        throw new Error(
          `Failed to reject track: ${errorData.error || response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Reject track success:", result);

      onTracksUpdate();
      setCurrentTrack(null);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error rejecting track:", error);
      alert(
        `Error rejecting track: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // Функция handleTrim больше не нужна, так как обрезка происходит напрямую в TrackTrimmer

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Listen & Review Tracks</h2>
        <p className="text-gray-600 mb-6">
          Listen to downloaded tracks and decide whether to accept or reject
          them.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track List */}
        <div>
          <h3 className="text-lg font-medium mb-3">Downloaded Tracks</h3>
          {downloadedTracks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No tracks available for review</p>
              <p className="text-sm">Download some tracks first</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {downloadedTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleTrackSelect(track)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentTrack?.id === track.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {track.metadata.title}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {track.metadata.artist}
                      </p>
                      {track.metadata.isTrimmed && (
                        <div className="flex items-center space-x-1 mt-1">
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
                            Обрезан
                          </span>
                          {track.metadata.trimSettings && (
                            <span className="text-xs text-gray-500">
                              {formatTime(
                                track.metadata.trimSettings.startTime
                              )}{" "}
                              -{" "}
                              {formatTime(
                                track.metadata.trimSettings.endTime ||
                                  track.metadata.trimSettings.startTime +
                                    (track.metadata.trimSettings.maxDuration ||
                                      360)
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {track.metadata.duration
                        ? formatTime(track.metadata.duration)
                        : "Unknown"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio Player */}
        <div>
          <h3 className="text-lg font-medium mb-3">Audio Player</h3>
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
                      Обрезан
                    </span>
                    {currentTrack.metadata.trimSettings && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-600">
                          Фрагмент:{" "}
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
                          Детали
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Audio Controls */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handlePlayPause}
                      className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700"
                    >
                      {isPlaying ? (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <span className="text-sm text-gray-600 min-w-[40px]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                </div>

                {/* Hidden Audio Element */}
                <audio
                  ref={audioRef}
                  src={`/api/audio/${currentTrack.id}`}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  onError={handleAudioError}
                />

                {/* Action Buttons */}
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={() => setShowTrimmer(true)}
                    disabled={isAccepting || isRejecting}
                    className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Настроить обрезку
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
                        Processing...
                      </div>
                    ) : (
                      "Accept Track"
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
                        Rejecting...
                      </div>
                    ) : (
                      "Reject Track"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Select a track to start listening</p>
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
