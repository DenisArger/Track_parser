"use client";

import { useState, useRef } from "react";
import { Track } from "@/types/track";
import TrackList from "./shared/TrackList";
import { getDownloadedTracks } from "@/lib/utils/trackFilters";
import { formatTime } from "@/lib/utils/timeFormatter";

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
  const audioRef = useRef<HTMLAudioElement>(null);

  const downloadedTracks = getDownloadedTracks(tracks);

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

  const handleAccept = async () => {
    if (!currentTrack) return;

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

      if (!response.ok) {
        throw new Error("Failed to process track");
      }

      onTracksUpdate();
      setCurrentTrack(null);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error processing track:", error);
    }
  };

  const handleReject = async () => {
    if (!currentTrack) return;

    try {
      const response = await fetch("/api/reject-track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackId: currentTrack.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject track");
      }

      onTracksUpdate();
      setCurrentTrack(null);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error rejecting track:", error);
    }
  };

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
          <TrackList
            tracks={downloadedTracks}
            onTrackSelect={handleTrackSelect}
            selectedTrackId={currentTrack?.id}
            showDuration={true}
            emptyMessage="No tracks available for review"
            emptySubMessage="Download some tracks first"
          />
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
                <p className="text-sm text-gray-600 mb-3">
                  {currentTrack.metadata.artist}
                </p>

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
                    onClick={handleAccept}
                    className="btn btn-success flex-1"
                  >
                    Accept Track
                  </button>
                  <button
                    onClick={handleReject}
                    className="btn btn-danger flex-1"
                  >
                    Reject Track
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
    </div>
  );
}
