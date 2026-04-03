"use client";

import { Track } from "@/types/track";
import TrackStatusBadge from "./TrackStatusBadge";
import { formatDuration } from "@/lib/utils/timeFormatter";
import { useI18n } from "../I18nProvider";
import Spinner from "../Spinner";

interface TrackListProps {
  tracks: Track[];
  isLoading?: boolean;
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
  isLoading = false,
  onTrackSelect,
  selectedTrackId,
  showStatus = false,
  showDuration = false,
  onRadioMap,
  emptyMessage,
  emptySubMessage,
  maxHeight = "max-h-96",
}: TrackListProps) {
  const { t } = useI18n();
  const resolvedEmptyMessage = emptyMessage ?? t("trackList.emptyDefault");

  if (tracks.length === 0) {
    if (isLoading) {
      return (
        <div className={`space-y-3 ${maxHeight} overflow-y-auto`}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="h-3 w-2/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 px-1 text-sm text-gray-500">
            <Spinner label={t("common.loading")} />
            <span>{t("common.loading")}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{resolvedEmptyMessage}</p>
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
                    {t("trackList.onRadio")}
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
            <p className="text-xs text-danger-600 mt-1">
              {t("trackList.errorLabel")}: {track.error}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
