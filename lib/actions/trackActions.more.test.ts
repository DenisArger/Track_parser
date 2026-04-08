import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTracksAction,
  deleteTrackAction,
  getTrackStatsAction,
  processTrackAction,
  rejectTrackAction,
  updateMetadataAction,
  uploadLocalTrackAction,
  uploadTrackAction,
} from "./trackActions";

const mockRequireAuth = vi.fn();
const mockUploadLocalTrack = vi.fn();
const mockProcessTrack = vi.fn();
const mockRejectTrack = vi.fn();
const mockGetTrackFromLib = vi.fn();
const mockUploadToFtp = vi.fn();

const mockGetTrackFromStorage = vi.fn();
const mockSetTrack = vi.fn();
const mockDeleteTrack = vi.fn();

const mockGetTrackStats = vi.fn();
const mockCleanupTrackStatuses = vi.fn();

const mockEnsureDir = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
const mockRemove = vi.fn();

const mockDownloadFileFromStorage = vi.fn();
const mockUploadFileToStorage = vi.fn();
const mockProcessAudioFile = vi.fn();
const mockWriteTrackTags = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/processTracks", () => ({
  getAllTracks: vi.fn(),
  downloadTrack: vi.fn(),
  uploadLocalTrack: (...args: unknown[]) => mockUploadLocalTrack(...args),
  processTrack: (...args: unknown[]) => mockProcessTrack(...args),
  rejectTrack: (...args: unknown[]) => mockRejectTrack(...args),
  getTrack: (...args: unknown[]) => mockGetTrackFromLib(...args),
  uploadToFtp: (...args: unknown[]) => mockUploadToFtp(...args),
}));

vi.mock("@/lib/storage/trackStorage", () => ({
  getTrack: (...args: unknown[]) => mockGetTrackFromStorage(...args),
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
  deleteTrack: (...args: unknown[]) => mockDeleteTrack(...args),
  deleteAllTracks: vi.fn(),
}));

vi.mock("@/lib/trackUtils", () => ({
  getTrackStats: (...args: unknown[]) => mockGetTrackStats(...args),
  cleanupTrackStatuses: (...args: unknown[]) => mockCleanupTrackStatuses(...args),
}));

vi.mock("@/lib/utils/environment", () => ({
  getSafeWorkingDirectory: () => "/tmp/work",
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  downloadFileFromStorage: (...args: unknown[]) => mockDownloadFileFromStorage(...args),
  uploadFileToStorage: (...args: unknown[]) => mockUploadFileToStorage(...args),
  STORAGE_BUCKETS: {
    downloads: "downloads",
    previews: "previews",
    processed: "processed",
  },
}));

vi.mock("@/lib/audio/audioProcessor", () => ({
  processAudioFile: (...args: unknown[]) => mockProcessAudioFile(...args),
}));

vi.mock("@/lib/audio/metadataWriter", () => ({
  writeTrackTags: (...args: unknown[]) => mockWriteTrackTags(...args),
}));

vi.mock("fs-extra", () => ({
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
}));

describe("trackActions additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "u1" });
    mockReadFile.mockResolvedValue(Buffer.from("file"));
    mockDownloadFileFromStorage.mockResolvedValue(Buffer.from("in"));
  });

  it("uploadLocalTrackAction validates file and uploads", async () => {
    mockUploadLocalTrack.mockResolvedValue({ id: "t-local" });

    await expect(
      uploadLocalTrackAction(Buffer.from("abc"), "a.mp3", "audio/mpeg")
    ).resolves.toEqual({ id: "t-local" });

    await expect(uploadLocalTrackAction(Buffer.alloc(0), "a.mp3")).rejects.toThrow(
      "Local upload failed: File is required"
    );
  });

  it("process and reject actions validate and wrap errors", async () => {
    mockProcessTrack.mockRejectedValueOnce(new Error("boom"));
    await expect(processTrackAction("t1", { title: "S" })).rejects.toThrow(
      "Processing failed: boom"
    );

    await expect(processTrackAction("", {})).rejects.toThrow(
      "Processing failed: Track ID is required"
    );

    mockRejectTrack.mockResolvedValueOnce(undefined);
    await expect(rejectTrackAction("t2")).resolves.toBeUndefined();

    await expect(rejectTrackAction("")).rejects.toThrow(
      "Failed to reject track: Track ID is required"
    );
  });

  it("updateMetadataAction updates storage and writes tags when processedPath exists", async () => {
    const track = {
      id: "t4",
      metadata: { title: "Old", artist: "A", album: "", genre: "Средний", rating: 5, year: 2024 },
      processedPath: "processed/t4/a.mp3",
    };
    mockGetTrackFromStorage.mockResolvedValue(track);

    const result = await updateMetadataAction("t4", {
      title: "New",
      artist: "B",
      album: "Alb",
      genre: "Быстрый",
      rating: 9,
      year: 2026,
    });

    expect(result.metadata.title).toBe("New");
    expect(mockWriteTrackTags).toHaveBeenCalled();
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "processed",
      "processed/t4/a.mp3",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
    expect(mockSetTrack).toHaveBeenCalledWith("t4", expect.objectContaining({ metadata: expect.objectContaining({ title: "New" }) }));
  });

  it("updateMetadataAction validates inputs and missing track", async () => {
    await expect(updateMetadataAction("", {} as any)).rejects.toThrow(
      "Failed to update metadata: Track ID and metadata are required"
    );

    mockGetTrackFromStorage.mockResolvedValue(null);
    await expect(updateMetadataAction("x", {} as any)).rejects.toThrow(
      "Failed to update metadata: Track not found"
    );
  });

  it("getTrackStatsAction and cleanupTracksAction", async () => {
    mockGetTrackStats
      .mockResolvedValueOnce({
        total: 2,
        downloaded: 1,
        processed: 0,
        approved: 1,
        rejected: 0,
        readyForUpload: 0,
        uploaded: 0,
        uploadedRadio: 0,
      })
      .mockResolvedValueOnce({
        total: 2,
        downloaded: 2,
        processed: 0,
        approved: 0,
        rejected: 0,
        readyForUpload: 0,
        uploaded: 0,
        uploadedRadio: 0,
      });

    const stats = await getTrackStatsAction();
    expect(stats.total).toBe(2);

    mockGetTrackStats.mockReset();
    mockGetTrackStats
      .mockResolvedValueOnce({
        total: 3,
        downloaded: 1,
        processed: 0,
        approved: 1,
        rejected: 0,
        readyForUpload: 0,
        uploaded: 0,
        uploadedRadio: 0,
      })
      .mockResolvedValueOnce({
        total: 3,
        downloaded: 2,
        processed: 0,
        approved: 1,
        rejected: 0,
        readyForUpload: 0,
        uploaded: 0,
        uploadedRadio: 0,
      });

    const cleaned = await cleanupTracksAction();
    expect(cleaned.statsBefore.total).toBe(3);
    expect(mockCleanupTrackStatuses).toHaveBeenCalled();

    mockGetTrackStats.mockRejectedValueOnce(new Error("stats fail"));
    await expect(getTrackStatsAction()).rejects.toThrow("Failed to get stats: stats fail");
  });

  it("deleteTrackAction and uploadTrackAction", async () => {
    await expect(deleteTrackAction("t1")).resolves.toBeUndefined();
    expect(mockDeleteTrack).toHaveBeenCalledWith("t1");

    await expect(deleteTrackAction("")).rejects.toThrow("Delete failed: Track ID is required");

    await expect(
      uploadTrackAction("t1", {
        host: "ftp.example.com",
        port: 21,
        user: "u",
        password: "p",
        secure: false,
      })
    ).resolves.toBeUndefined();
    expect(mockUploadToFtp).toHaveBeenCalled();

    await expect(uploadTrackAction("", null as any)).rejects.toThrow(
      "FTP upload failed: Track ID and FTP config are required"
    );
  });
});
