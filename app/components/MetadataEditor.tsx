"use client";

import { useEffect, useState } from "react";
import { Track, TrackMetadata, TrackType, TrackStatus } from "@/types/track";
import TrackList from "./shared/TrackList";
import TrackStatusBadge from "./shared/TrackStatusBadge";
import { getProcessedTracks } from "@/lib/utils/trackFilters";
import { formatTime } from "@/lib/utils/timeFormatter";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { useI18n } from "./I18nProvider";

interface MetadataEditorProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

export default function MetadataEditor({
  onTracksUpdate,
  tracks,
  onRadioMap,
}: MetadataEditorProps) {
  const { t } = useI18n();
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [metadata, setMetadata] = useState<TrackMetadata>({
    title: "",
    artist: "",
    album: "",
    genre: "Средний",
    rating: 5,
    year: 2025,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [artistSuggestions, setArtistSuggestions] = useState<string[]>([]);
  const processedTracks = getProcessedTracks(tracks);
  const trackTypes: TrackType[] = ["Быстрый", "Средний", "Медленный", "Модерн"];
  const trackTypeLabels: Record<TrackType, string> = {
    "Быстрый": t("trackTypes.fast"),
    "Средний": t("trackTypes.mid"),
    "Медленный": t("trackTypes.slow"),
    "Модерн": t("trackTypes.modern"),
  };

  useEffect(() => {
    let isMounted = true;
    const loadArtists = async () => {
      try {
        const res = await fetch("/api/radio/artists", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          console.warn("Failed to load artist suggestions:", res.status);
          return;
        }
        const data = (await res.json()) as { artists?: string[] };
        if (isMounted && Array.isArray(data.artists)) {
          setArtistSuggestions(data.artists);
        }
      } catch (error) {
        console.warn("Failed to load artist suggestions:", error);
      }
    };
    loadArtists();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTrackSelect = (track: Track) => {
    setSelectedTrack(track);
    setMetadata({ ...track.metadata });
  };

  const handleMetadataChange = (
    field: keyof TrackMetadata,
    value: string | number
  ) => {
    setMetadata((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!selectedTrack) return;

    setIsSaving(true);

    try {
      const { updateMetadataAction } = await import(
        "@/lib/actions/trackActions"
      );
      const result = await updateMetadataAction(selectedTrack.id, metadata);
      console.warn("Metadata updated successfully:", result);

      onTracksUpdate();
      setSelectedTrack(null);
      setMetadata({
        title: "",
        artist: "",
        album: "",
        genre: "Средний",
        rating: 5,
        year: 2025,
      });
    } catch (error) {
      console.error("Error updating metadata:", error);
      alert(
        `${t("metadata.errors.update")}: ${getUserFacingErrorMessage(
          error,
          t("metadata.errors.unknown")
        )}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("metadata.title")}</h2>
        <p className="text-gray-600 mb-6">{t("metadata.description")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track List */}
        <div>
          <h3 className="text-lg font-medium mb-3">{t("metadata.processedTitle")}</h3>
          <TrackList
            tracks={processedTracks}
            onTrackSelect={handleTrackSelect}
            selectedTrackId={selectedTrack?.id}
            showStatus={false}
            onRadioMap={onRadioMap}
            emptyMessage={t("metadata.emptyMessage")}
            emptySubMessage={t("metadata.emptySubMessage")}
          />
        </div>

        {/* Metadata Editor */}
        <div>
          <h3 className="text-lg font-medium mb-3">{t("metadata.editorTitle")}</h3>
          {selectedTrack ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">
                  {t("metadata.editing")}: {selectedTrack.metadata.title}
                </h4>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {t("metadata.fields.title")}
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={metadata.title}
                      onChange={(e) =>
                        handleMetadataChange("title", e.target.value)
                      }
                      className="input"
                    />
                  </div>

                  {/* Artist */}
                  <div>
                    <label
                      htmlFor="artist"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {t("metadata.fields.artist")}
                    </label>
                    <input
                      type="text"
                      id="artist"
                      list="artist-suggestions"
                      value={metadata.artist}
                      onChange={(e) =>
                        handleMetadataChange("artist", e.target.value)
                      }
                      className="input"
                    />
                    {artistSuggestions.length > 0 && (
                      <datalist id="artist-suggestions">
                        {artistSuggestions.map((artist) => (
                          <option key={artist} value={artist} />
                        ))}
                      </datalist>
                    )}
                  </div>

                  {/* Album */}
                  <div>
                    <label
                      htmlFor="album"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {t("metadata.fields.album")}
                    </label>
                    <input
                      type="text"
                      id="album"
                      value={metadata.album}
                      onChange={(e) =>
                        handleMetadataChange("album", e.target.value)
                      }
                      className="input"
                    />
                  </div>

                  {/* Track Type */}
                  <div>
                    <label
                      htmlFor="genre"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {t("metadata.fields.genre")}
                    </label>
                    <select
                      id="genre"
                      value={metadata.genre}
                      onChange={(e) =>
                        handleMetadataChange(
                          "genre",
                          e.target.value as TrackType
                        )
                      }
                      className="input"
                    >
                      {trackTypes.map((type) => (
                        <option key={type} value={type}>
                          {trackTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rating */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="rating"
                        className="block text-sm font-medium text-gray-700"
                      >
                        {t("metadata.fields.rating")}
                      </label>
                      <span className="text-xs text-gray-500">
                        {t("metadata.ratingHint")}
                      </span>
                    </div>
                    <input
                      type="number"
                      id="rating"
                      min="1"
                      max="10"
                      value={metadata.rating}
                      onChange={(e) =>
                        handleMetadataChange("rating", parseInt(e.target.value))
                      }
                      className="input"
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label
                      htmlFor="year"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {t("metadata.fields.year")}
                    </label>
                    <input
                      type="number"
                      id="year"
                      min="1900"
                      max="2030"
                      value={metadata.year}
                      onChange={(e) =>
                        handleMetadataChange("year", parseInt(e.target.value))
                      }
                      className="input"
                    />
                  </div>

                  {/* Duration (read-only) */}
                  {metadata.duration && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t("metadata.fields.duration")}
                      </label>
                      <input
                        type="text"
                        value={formatTime(metadata.duration)}
                        className="input bg-gray-100"
                        readOnly
                      />
                    </div>
                  )}

                  {/* Status Change */}
                  <div>
                    <label
                      htmlFor="status"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {t("metadata.fields.status")}
                    </label>
                    <div className="flex items-center space-x-3">
                      <select
                        id="status"
                        value={selectedTrack.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value as TrackStatus;
                          if (newStatus === selectedTrack.status) return;

                          setIsChangingStatus(true);
                          try {
                            const response = await fetch(
                              `/api/tracks/${selectedTrack.id}/status`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: newStatus }),
                              }
                            );

                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(
                                errorData.error || t("metadata.errors.changeStatus")
                              );
                            }

                            onTracksUpdate();
                            // Update selected track status
                            setSelectedTrack({ ...selectedTrack, status: newStatus });
                          } catch (error) {
                            console.error("Error changing status:", error);
                            alert(
                              `${t("metadata.errors.changeStatus")}: ${getUserFacingErrorMessage(
                                error,
                                t("metadata.errors.unknown")
                              )}`
                            );
                          } finally {
                            setIsChangingStatus(false);
                          }
                        }}
                        disabled={isChangingStatus}
                        className="input flex-1 disabled:opacity-50"
                      >
                        <option value="downloaded">{t("status.downloaded")}</option>
                        <option value="processed">{t("status.processed")}</option>
                        <option value="trimmed">{t("status.trimmed")}</option>
                        <option value="uploaded">{t("status.uploaded")}</option>
                        <option value="rejected">{t("status.rejected")}</option>
                        <option value="error">{t("status.error")}</option>
                      </select>
                      <TrackStatusBadge status={selectedTrack.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {t("metadata.statusHint")}
                    </p>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn btn-primary w-full disabled:opacity-50"
                  >
                    {isSaving ? t("metadata.saving") : t("metadata.save")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>{t("metadata.selectPrompt")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
