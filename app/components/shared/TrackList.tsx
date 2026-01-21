"use client";

import { Track } from "@/types/track";
import TrackStatusBadge from "./TrackStatusBadge";
import { formatDuration } from "@/lib/utils/timeFormatter";

interface TrackListProps {
  tracks: Track[];
  onTrackSelect?: (track: Track) => void;
  selectedTrackId?: string;
  showStatus?: boolean;
  showDuration?: boolean;
  onRadioMap?: Record<string, boolean>;
  emptyMessage?: string;
  emptySubMessage?: string;
  maxHeight?: string;
}

export default function TrackList({
  tracks,
  onTrackSelect,
  selectedTrackId,
  showStatus = false,
  showDuration = false,
  onRadioMap,
  emptyMessage = "No tracks available",
  emptySubMessage,
  maxHeight = "max-h-96",
}: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{emptyMessage}</p>
        {emptySubMessage && <p className="text-sm">{emptySubMessage}</p>}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${maxHeight} overflow-y-auto`}>
      {tracks.map((track) => (
        <div
          key={track.id}
          onClick={() => onTrackSelect?.(track)}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedTrackId === track.id
              ? "border-primary-500 bg-primary-50"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {track.metadata.title}
              </h4>
              <p className="text-sm text-gray-600 truncate">
                {track.metadata.artist}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                {showStatus && <TrackStatusBadge status={track.status} />}
                {onRadioMap?.[track.id] && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    На радио
                  </span>
                )}
                {showDuration && (
                  <span className="text-xs text-gray-500">
                    {formatDuration(track.metadata.duration)}
                  </span>
                )}
              </div>
            </div>
            {!showDuration && track.metadata.duration && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatDuration(track.metadata.duration)}
              </span>
            )}
          </div>
          {track.error && (
            <p className="text-xs text-danger-600 mt-1">Error: {track.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}
