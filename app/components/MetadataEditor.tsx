"use client";

import { useState } from "react";
import { Track, TrackMetadata, TrackType } from "@/types/track";
import TrackList from "./shared/TrackList";
import TrackStatusBadge from "./shared/TrackStatusBadge";
import { getProcessedTracks } from "@/lib/utils/trackFilters";
import { formatTime } from "@/lib/utils/timeFormatter";

interface MetadataEditorProps {
  onTracksUpdate: () => void;
  tracks: Track[];
}

export default function MetadataEditor({
  onTracksUpdate,
  tracks,
}: MetadataEditorProps) {
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

  const processedTracks = getProcessedTracks(tracks);

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
      const response = await fetch("/api/update-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId: selectedTrack.id,
          metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update metadata");
      }

      const result = await response.json();
      console.log("Metadata updated successfully:", result);

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
        `Error updating metadata: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const trackTypes: TrackType[] = ["Быстрый", "Средний", "Медленный"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Edit Track Metadata</h2>
        <p className="text-gray-600 mb-6">
          Edit metadata for processed tracks before uploading to the server.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track List */}
        <div>
          <h3 className="text-lg font-medium mb-3">Processed Tracks</h3>
          <TrackList
            tracks={processedTracks}
            onTrackSelect={handleTrackSelect}
            selectedTrackId={selectedTrack?.id}
            showStatus={false}
            emptyMessage="No processed tracks available"
            emptySubMessage="Process some tracks first"
          />
        </div>

        {/* Metadata Editor */}
        <div>
          <h3 className="text-lg font-medium mb-3">Metadata Editor</h3>
          {selectedTrack ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">
                  Editing: {selectedTrack.metadata.title}
                </h4>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Title
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
                      Artist
                    </label>
                    <input
                      type="text"
                      id="artist"
                      value={metadata.artist}
                      onChange={(e) =>
                        handleMetadataChange("artist", e.target.value)
                      }
                      className="input"
                    />
                  </div>

                  {/* Album */}
                  <div>
                    <label
                      htmlFor="album"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Album
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
                      Track Type
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
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rating */}
                  <div>
                    <label
                      htmlFor="rating"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Rating (1-10)
                    </label>
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
                      Year
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
                        Duration
                      </label>
                      <input
                        type="text"
                        value={formatTime(metadata.duration)}
                        className="input bg-gray-100"
                        readOnly
                      />
                    </div>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn btn-primary w-full disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Metadata"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Select a track to edit metadata</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
