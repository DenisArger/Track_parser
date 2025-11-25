"use client";

import { useState } from "react";
import { Track, FtpConfig } from "@/types/track";
import {
  getProcessedTracks,
  getUploadedTracks,
} from "@/lib/utils/trackFilters";

interface FtpUploaderProps {
  onTracksUpdate: () => void;
  tracks: Track[];
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
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [error, setError] = useState("");

  const processedTracks = getProcessedTracks(tracks);

  const handleFtpConfigChange = (
    field: keyof FtpConfig,
    value: string | number | boolean
  ) => {
    setFtpConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUploadTrack = async (trackId: string) => {
    setIsUploading(true);
    setError("");

    try {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      onTracksUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadAll = async () => {
    if (processedTracks.length === 0) {
      setError("No tracks available for upload");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      for (const track of processedTracks) {
        setUploadProgress((prev) => ({ ...prev, [track.id]: 0 }));

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

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Failed to upload ${track.metadata.title}: ${errorData.error}`
          );
        }

        setUploadProgress((prev) => ({ ...prev, [track.id]: 100 }));
      }

      onTracksUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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
          Configure FTP settings and upload processed tracks to your server.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FTP Configuration */}
        <div>
          <h3 className="text-lg font-medium mb-3">FTP Settings</h3>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="host"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Host
              </label>
              <input
                type="text"
                id="host"
                value={ftpConfig.host}
                onChange={(e) => handleFtpConfigChange("host", e.target.value)}
                placeholder="ftp.example.com"
                className="input"
              />
            </div>

            <div>
              <label
                htmlFor="port"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Port
              </label>
              <input
                type="number"
                id="port"
                value={ftpConfig.port}
                onChange={(e) =>
                  handleFtpConfigChange("port", parseInt(e.target.value))
                }
                className="input"
              />
            </div>

            <div>
              <label
                htmlFor="user"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                type="text"
                id="user"
                value={ftpConfig.user}
                onChange={(e) => handleFtpConfigChange("user", e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={ftpConfig.password}
                onChange={(e) =>
                  handleFtpConfigChange("password", e.target.value)
                }
                className="input"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="secure"
                checked={ftpConfig.secure}
                onChange={(e) =>
                  handleFtpConfigChange("secure", e.target.checked)
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label
                htmlFor="secure"
                className="ml-2 block text-sm text-gray-900"
              >
                Use secure connection (FTPS)
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleTestConnection}
                className="btn btn-secondary"
              >
                Test Connection
              </button>
            </div>
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
              <p className="text-sm">Process some tracks first</p>
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
