"use client";

import { useState, useEffect } from "react";
import { Track, FtpConfig } from "@/types/track";
import { getUploadedTracks } from "@/lib/utils/trackFilters";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";

interface FtpUploaderProps {
  onTracksUpdate: () => void;
  tracks: Track[];
  onRadioMap?: Record<string, boolean>;
}

export default function FtpUploader({
  onTracksUpdate,
  tracks,
}: FtpUploaderProps) {
  const [ftpConfig, setFtpConfig] = useState<FtpConfig>({
    host: "",
    port: 21,
    user: "",
    password: "",
    secure: false,
    remotePath: "",
  });

  // Load FTP config from server on component mount
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
        // Keep default empty values if loading fails
      }
    };

    loadFtpConfig();
  }, []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [hiddenTrackIds, setHiddenTrackIds] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (Object.keys(hiddenTrackIds).length > 0) {
      setHiddenTrackIds({});
    }
  }, [tracks]);

  // Get tracks that can be uploaded (processed or trimmed with processedPath)
  const processedTracks = tracks.filter(
    (track) =>
      (track.status === "processed" || 
       track.status === "trimmed") &&
      track.processedPath &&
      !hiddenTrackIds[track.id]
  );

  const handleUploadTrack = async (trackId: string) => {
    setIsUploading(true);
    setError("");

    try {
      console.log("Uploading track:", trackId);
      console.log("FTP config:", {
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.user,
        remotePath: ftpConfig.remotePath || "(root)",
      });

      const response = await fetch("/api/upload-ftp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId,
          ftpConfig,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Upload failed:", responseData);
        throw new Error(responseData.error || "Upload failed");
      }

      console.log("Upload successful:", responseData);
      setHiddenTrackIds((prev) => ({ ...prev, [trackId]: true }));
      onTracksUpdate();
    } catch (err) {
      const errorMessage = getUserFacingErrorMessage(err, "Upload failed");
      console.error("Upload error:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFromQueue = (trackId: string) => {
    setHiddenTrackIds((prev) => ({ ...prev, [trackId]: true }));
  };

  const handleUploadAll = async () => {
    if (processedTracks.length === 0) {
      setError("No tracks available for upload");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      console.log(`Starting upload of ${processedTracks.length} tracks`);
      
      for (const track of processedTracks) {
        console.log(`Uploading track: ${track.id} - ${track.metadata.title}`);
        setUploadProgress((prev) => ({ ...prev, [track.id]: 0 }));

        try {
          const response = await fetch("/api/upload-ftp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              trackId: track.id,
              ftpConfig,
            }),
          });

          const responseData = await response.json();

          if (!response.ok) {
            const errorMsg = responseData.error || "Upload failed";
            console.error(`Upload failed for ${track.metadata.title}:`, errorMsg);
            throw new Error(`Failed to upload ${track.metadata.title}: ${errorMsg}`);
          }

          console.log(`Successfully uploaded: ${track.metadata.title}`);
          setUploadProgress((prev) => ({ ...prev, [track.id]: 100 }));
          setHiddenTrackIds((prev) => ({ ...prev, [track.id]: true }));
        } catch (trackError) {
          console.error(`Error uploading track ${track.id}:`, trackError);
          setUploadProgress((prev) => ({ ...prev, [track.id]: 0 }));
          // Continue with next track instead of stopping all
          setError(
            `Failed to upload ${track.metadata.title}: ${
              trackError instanceof Error ? trackError.message : String(trackError)
            }`
          );
        }
      }

      console.log("All uploads completed");
      onTracksUpdate();
    } catch (err) {
      const errorMessage = getUserFacingErrorMessage(err, "Upload failed");
      console.error("Upload all error:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const handleTestConnection = async () => {
    try {
      const response = await fetch("/api/test-ftp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ftpConfig),
      });

      if (!response.ok) {
        throw new Error("Connection failed");
      }

      alert("FTP connection successful!");
    } catch (error) {
      setError("FTP connection failed. Please check your settings.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">FTP Upload Configuration</h2>
        <p className="text-gray-600 mb-6">
          Test FTP connection and upload processed tracks to your server.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex space-x-3">
            <button
              onClick={handleTestConnection}
              className="btn btn-secondary"
            >
              Test Connection
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div>
          <h3 className="text-lg font-medium mb-3">Upload Tracks</h3>

          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 mb-4">
              <p className="text-danger-700 text-sm">{error}</p>
            </div>
          )}

          {processedTracks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No processed tracks available for upload</p>
              <p className="text-sm mt-2">
                Process or trim some tracks first. Tracks must have status &quot;processed&quot;, &quot;trimmed&quot;, or &quot;uploaded&quot; with a processed path.
              </p>
              <p className="text-xs mt-1 text-gray-400">
                Available tracks: {tracks.length} total, {tracks.filter(t => (t.status === "processed" || t.status === "trimmed" || t.status === "uploaded") && t.processedPath).length} ready for upload
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleUploadAll}
                disabled={isUploading || !ftpConfig.host || !ftpConfig.user}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {isUploading
                  ? "Uploading All Tracks..."
                  : `Upload All Tracks (${processedTracks.length})`}
              </button>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {processedTracks.map((track) => (
                  <div
                    key={track.id}
                    className="border rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {track.metadata.title}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {track.metadata.artist}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {uploadProgress[track.id] !== undefined && (
                          <span className="text-sm text-gray-600">
                            {uploadProgress[track.id]}%
                          </span>
                        )}
                        <button
                          onClick={() => handleUploadTrack(track.id)}
                          disabled={isUploading}
                          className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => handleRemoveFromQueue(track.id)}
                          disabled={isUploading}
                          className="btn btn-secondary text-sm disabled:opacity-50"
                        >
                          Remove from queue
                        </button>
                      </div>
                    </div>
                    {uploadProgress[track.id] !== undefined &&
                      uploadProgress[track.id] < 100 && (
                        <div className="progress-bar mt-2">
                          <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress[track.id]}%` }}
                          ></div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Tracks Summary */}
      {getUploadedTracks(tracks).length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">Recently Uploaded</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getUploadedTracks(tracks)
              .slice(0, 6)
              .map((track) => (
                <div
                  key={track.id}
                  className="border rounded-lg p-3 bg-green-50"
                >
                  <h4 className="font-medium text-gray-900 truncate">
                    {track.metadata.title}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {track.metadata.artist}
                  </p>
                  <span className="text-xs text-green-600 font-medium">
                    Uploaded successfully
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
