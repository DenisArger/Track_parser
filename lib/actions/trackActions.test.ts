import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeTrackStatusAction,
  downloadTrackAction,
  getAllTracks,
  resetAllDataAction,
  testFtpConnectionAction,
} from "./trackActions";

const mockGetAllTracksFromLib = vi.fn();
const mockDownloadTrackFromLib = vi.fn();
const mockGetTrackFromStorage = vi.fn();
const mockSetTrack = vi.fn();
const mockDeleteAllTracks = vi.fn();
const mockRequireAuth = vi.fn();
const mockDetectSourceFromUrl = vi.fn();
const mockClientAccess = vi.fn();
const mockClientClose = vi.fn();

vi.mock("@/lib/processTracks", () => ({
  getAllTracks: (...args: unknown[]) => mockGetAllTracksFromLib(...args),
  downloadTrack: (...args: unknown[]) => mockDownloadTrackFromLib(...args),
  uploadLocalTrack: vi.fn(),
  processTrack: vi.fn(),
  rejectTrack: vi.fn(),
  trimTrack: vi.fn(),
  getTrack: vi.fn(),
  uploadToFtp: vi.fn(),
}));

vi.mock("@/lib/trackUtils", () => ({
  getTrackStats: vi.fn(),
  cleanupTrackStatuses: vi.fn(),
}));

vi.mock("@/lib/storage/trackStorage", () => ({
  getTrack: (...args: unknown[]) => mockGetTrackFromStorage(...args),
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
  deleteTrack: vi.fn(),
  deleteAllTracks: (...args: unknown[]) => mockDeleteAllTracks(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/utils/sourceDetection", () => ({
  detectSourceFromUrl: (...args: unknown[]) => mockDetectSourceFromUrl(...args),
}));

vi.mock("basic-ftp", () => ({
  Client: class {
    constructor() {}
    access(config: unknown) {
      return mockClientAccess(config);
    }
    close() {
      mockClientClose();
    }
  },
}));

describe("trackActions", () => {
  const processEnvBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env = { ...processEnvBackup };
    delete process.env.NEXT_PHASE;
    delete process.env.NETLIFY;
    delete process.env.NETLIFY_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NETLIFY_DEV;
    process.env.NODE_ENV = "test";
    mockRequireAuth.mockResolvedValue({ id: "u-1" });
  });

  it("getAllTracks returns empty during production build phase", async () => {
    process.env.NEXT_PHASE = "phase-production-build";

    const tracks = await getAllTracks();

    expect(tracks).toEqual([]);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it("getAllTracks maps tracks from library", async () => {
    mockGetAllTracksFromLib.mockResolvedValue([
      {
        id: "t1",
        filename: "a.mp3",
        originalPath: "downloads/a.mp3",
        processedPath: "processed/a.mp3",
        metadata: { title: "Song", artist: "Artist", rating: 5, year: 2020 },
        status: "downloaded",
      },
    ]);

    const tracks = await getAllTracks();

    expect(mockRequireAuth).toHaveBeenCalled();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      id: "t1",
      filename: "a.mp3",
      metadata: { title: "Song", artist: "Artist", rating: 5, year: 2020 },
      status: "downloaded",
    });
  });

  it("downloadTrackAction validates url", async () => {
    const result = await downloadTrackAction("");

    expect(result).toEqual({ ok: false, error: "URL is required" });
    expect(mockDownloadTrackFromLib).not.toHaveBeenCalled();
  });

  it("downloadTrackAction detects source and returns success", async () => {
    mockDetectSourceFromUrl.mockReturnValue("youtube-music");
    mockDownloadTrackFromLib.mockResolvedValue({ id: "t1" });

    const result = await downloadTrackAction("https://music.youtube.com/watch?v=1");

    expect(result).toEqual({ ok: true, track: { id: "t1" } });
    expect(mockDetectSourceFromUrl).toHaveBeenCalled();
    expect(mockDownloadTrackFromLib).toHaveBeenCalledWith(
      "https://music.youtube.com/watch?v=1",
      "youtube-music"
    );
  });

  it("downloadTrackAction maps 451 errors to user-friendly message", async () => {
    mockDownloadTrackFromLib.mockRejectedValue(
      new Error("451 Unavailable For Legal Reasons")
    );

    const result = await downloadTrackAction("https://example.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Трек недоступен для скачивания");
    }
  });

  it("changeTrackStatusAction updates status and clears error", async () => {
    mockGetTrackFromStorage.mockResolvedValue({
      id: "t1",
      status: "error",
      error: "something failed",
      metadata: {},
    });
    mockSetTrack.mockResolvedValue(undefined);

    const updated = await changeTrackStatusAction("t1", "downloaded");

    expect(updated.status).toBe("downloaded");
    expect(updated.error).toBeUndefined();
    expect(mockSetTrack).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "downloaded" }));
  });

  it("changeTrackStatusAction throws wrapped error when track does not exist", async () => {
    mockGetTrackFromStorage.mockResolvedValue(null);

    await expect(changeTrackStatusAction("missing", "downloaded")).rejects.toThrow(
      "Failed to change track status: Track not found"
    );
  });

  it("resetAllDataAction returns success payload", async () => {
    mockDeleteAllTracks.mockResolvedValue({
      deleted: 3,
      cleared: { downloads: 3, processed: 2 },
    });

    const result = await resetAllDataAction();

    expect(result).toEqual({
      ok: true,
      deleted: 3,
      cleared: { downloads: 3, processed: 2 },
    });
  });

  it("resetAllDataAction returns structured error instead of throw", async () => {
    mockDeleteAllTracks.mockRejectedValue(new Error("storage error"));

    const result = await resetAllDataAction();

    expect(result).toEqual({
      ok: false,
      deleted: 0,
      cleared: {},
      error: "storage error",
    });
  });

  it("testFtpConnectionAction validates required fields", async () => {
    await expect(
      testFtpConnectionAction({
        host: "",
        user: "",
        password: "",
        secure: false,
      })
    ).rejects.toThrow("FTP connection failed: Host and username are required");
  });

  it("testFtpConnectionAction connects and closes client", async () => {
    mockClientAccess.mockResolvedValue(undefined);

    await testFtpConnectionAction({
      host: "ftp.example.com",
      port: 21,
      user: "user",
      password: "pass",
      secure: false,
    });

    expect(mockClientAccess).toHaveBeenCalledWith({
      host: "ftp.example.com",
      port: 21,
      user: "user",
      password: "pass",
      secure: false,
    });
    expect(mockClientClose).toHaveBeenCalled();
  });
});
