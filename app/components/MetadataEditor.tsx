"use client";

import { useState } from "react";
import { Track, TrackMetadata, TrackType } from "@/types/track";

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

  const processedTracks = tracks.filter(
    (track) => track.status === "processed"
  );

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
          {processedTracks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No processed tracks available</p>
              <p className="text-sm">Process some tracks first</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {processedTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleTrackSelect(track)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTrack?.id === track.id
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
                      <div className="flex items-center space-x-2 mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            track.metadata.genre === "Быстрый"
                              ? "bg-green-100 text-green-800"
                              : track.metadata.genre === "Медленный"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {track.metadata.genre}
                        </span>
                        <span className="text-xs text-gray-500">
                          Rating: {track.metadata.rating}/10
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                        value={`${Math.floor(metadata.duration / 60)}:${(
                          metadata.duration % 60
                        )
                          .toString()
                          .padStart(2, "0")}`}
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
