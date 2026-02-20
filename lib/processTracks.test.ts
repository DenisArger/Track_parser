import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateTrackId = vi.fn();
const mockGetAllTracksFromStorage = vi.fn();
const mockGetTrackFromStorage = vi.fn();
const mockSetTrack = vi.fn();

const mockDownloadFileFromStorage = vi.fn();
const mockUploadFileToStorage = vi.fn();
const mockDeleteFileFromStorage = vi.fn();
const mockSanitizeFilenameForStorage = vi.fn();

const mockUploadToFtpImpl = vi.fn();
const mockAddRadioTrack = vi.fn();
const mockGenerateSafeFilename = vi.fn();
const mockNormalizeForMatch = vi.fn();
const mockLoadConfig = vi.fn();
const mockDownloadTrackViaRapidAPI = vi.fn();
const mockIsServerlessEnvironment = vi.fn();
const mockFindFfmpegPath = vi.fn();
const mockGetYtDlpPath = vi.fn();
const mockSpawn = vi.fn();
const mockFsWriteFile = vi.fn();
const mockFsReadFile = vi.fn();
const mockFsRemove = vi.fn();
const mockFsPathExists = vi.fn();
const mockFsEnsureDir = vi.fn();
const mockFsReaddir = vi.fn();
const mockProcessAudioFile = vi.fn();
const mockDetectBpmNetlify = vi.fn();
const mockWriteTrackTags = vi.fn();

vi.mock("./storage/trackStorage", () => ({
  generateTrackId: (...args: unknown[]) => mockGenerateTrackId(...args),
  getAllTracks: (...args: unknown[]) => mockGetAllTracksFromStorage(...args),
  getTrack: (...args: unknown[]) => mockGetTrackFromStorage(...args),
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
}));

vi.mock("./storage/supabaseStorage", () => ({
  downloadFileFromStorage: (...args: unknown[]) =>
    mockDownloadFileFromStorage(...args),
  uploadFileToStorage: (...args: unknown[]) => mockUploadFileToStorage(...args),
  deleteFileFromStorage: (...args: unknown[]) => mockDeleteFileFromStorage(...args),
  sanitizeFilenameForStorage: (...args: unknown[]) =>
    mockSanitizeFilenameForStorage(...args),
  STORAGE_BUCKETS: {
    downloads: "downloads-bucket",
    rejected: "rejected-bucket",
    processed: "processed-bucket",
  },
}));

vi.mock("./upload/ftpUploader", () => ({
  uploadToFtp: (...args: unknown[]) => mockUploadToFtpImpl(...args),
}));

vi.mock("@/lib/radio/radioTracks", () => ({
  addRadioTrack: (...args: unknown[]) => mockAddRadioTrack(...args),
}));

vi.mock("@/lib/utils/filenameUtils", () => ({
  generateSafeFilename: (...args: unknown[]) => mockGenerateSafeFilename(...args),
  normalizeForMatch: (...args: unknown[]) => mockNormalizeForMatch(...args),
}));

vi.mock("./config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock("./download/youtubeDownloader", () => ({
  downloadTrackViaRapidAPI: (...args: unknown[]) =>
    mockDownloadTrackViaRapidAPI(...args),
}));

vi.mock("./utils/environment", () => ({
  isServerlessEnvironment: (...args: unknown[]) =>
    mockIsServerlessEnvironment(...args),
}));

vi.mock("./utils/ffmpegFinder", () => ({
  findFfmpegPath: (...args: unknown[]) => mockFindFfmpegPath(...args),
}));

vi.mock("./utils/ytDlpFinder", () => ({
  getYtDlpPath: (...args: unknown[]) => mockGetYtDlpPath(...args),
}));

vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock("fs-extra", () => ({
  ensureDir: (...args: unknown[]) => mockFsEnsureDir(...args),
  readdir: (...args: unknown[]) => mockFsReaddir(...args),
  writeFile: (...args: unknown[]) => mockFsWriteFile(...args),
  readFile: (...args: unknown[]) => mockFsReadFile(...args),
  remove: (...args: unknown[]) => mockFsRemove(...args),
  pathExists: (...args: unknown[]) => mockFsPathExists(...args),
}));

vi.mock("./audio/audioProcessor", () => ({
  processAudioFile: (...args: unknown[]) => mockProcessAudioFile(...args),
}));

vi.mock("./audio/bpmDetectorNetlify", () => ({
  detectBpmNetlify: (...args: unknown[]) => mockDetectBpmNetlify(...args),
}));

vi.mock("./audio/metadataWriter", () => ({
  writeTrackTags: (...args: unknown[]) => mockWriteTrackTags(...args),
}));

describe("processTracks basic flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.NEXT_PHASE;
    delete process.env.NODE_ENV;
    delete process.env.NETLIFY_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NETLIFY_DEV;

    mockLoadConfig.mockResolvedValue({
      folders: { downloads: "/tmp/downloads", processed: "/tmp/processed" },
      processing: { defaultRating: 5, defaultYear: 2026, maxDuration: 360 },
    });
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGenerateTrackId.mockReturnValue("generated-track-id");
    mockSanitizeFilenameForStorage.mockImplementation((name: string) => name);
    mockDownloadTrackViaRapidAPI.mockImplementation(
      async (_url: string, _dir: string, trackId: string) => ({
        filePath: "/tmp/downloads/Artist - Song.mp3",
        storagePath: `${trackId}/Artist - Song.mp3`,
        title: "Artist - Song",
      })
    );
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockGetYtDlpPath.mockResolvedValue("/usr/bin/yt-dlp");
    mockFsEnsureDir.mockResolvedValue(undefined);
    mockFsReaddir.mockResolvedValue([]);
    mockFsWriteFile.mockResolvedValue(undefined);
    mockFsReadFile.mockResolvedValue(Buffer.from("processed-audio"));
    mockFsRemove.mockResolvedValue(undefined);
    mockFsPathExists.mockResolvedValue(true);
    mockProcessAudioFile.mockResolvedValue(undefined);
    mockDetectBpmNetlify.mockResolvedValue(120);
    mockWriteTrackTags.mockResolvedValue(undefined);
  });

  it("getAllTracks returns empty array during Next.js production build phase", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    const { getAllTracks } = await import("./processTracks");

    await expect(getAllTracks()).resolves.toEqual([]);
    expect(mockGetAllTracksFromStorage).not.toHaveBeenCalled();
  });

  it("getAllTracks returns tracks from storage outside build phase", async () => {
    mockGetAllTracksFromStorage.mockResolvedValue([{ id: "t1" }]);
    const { getAllTracks } = await import("./processTracks");

    await expect(getAllTracks()).resolves.toEqual([{ id: "t1" }]);
    expect(mockGetAllTracksFromStorage).toHaveBeenCalledTimes(1);
  });

  it("getAllTracks returns empty array on storage error", async () => {
    mockGetAllTracksFromStorage.mockRejectedValue(new Error("storage failed"));
    const { getAllTracks } = await import("./processTracks");

    await expect(getAllTracks()).resolves.toEqual([]);
  });

  it("getTrack proxies to storage layer", async () => {
    mockGetTrackFromStorage.mockResolvedValue({ id: "track-1" });
    const { getTrack } = await import("./processTracks");

    await expect(getTrack("track-1")).resolves.toEqual({ id: "track-1" });
    expect(mockGetTrackFromStorage).toHaveBeenCalledWith("track-1");
  });

  it("rejectTrack moves file from downloads to rejected and updates status", async () => {
    const track = {
      id: "track-1",
      originalPath: "track-1/file.mp3",
      status: "downloaded",
      metadata: {},
    };
    mockGetTrackFromStorage.mockResolvedValue(track);
    mockDownloadFileFromStorage.mockResolvedValue(Buffer.from("audio"));
    mockUploadFileToStorage.mockResolvedValue({ path: "track-1/file.mp3" });
    mockDeleteFileFromStorage.mockResolvedValue(undefined);
    const { rejectTrack } = await import("./processTracks");

    await rejectTrack("track-1");

    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "track-1/file.mp3"
    );
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "rejected-bucket",
      "track-1/file.mp3",
      expect.any(Buffer),
      { contentType: "audio/mpeg", upsert: true }
    );
    expect(mockDeleteFileFromStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "track-1/file.mp3"
    );
    expect(mockSetTrack).toHaveBeenCalledWith(
      "track-1",
      expect.objectContaining({ status: "rejected" })
    );
  });

  it("rejectTrack throws for missing track or missing source file path", async () => {
    mockGetTrackFromStorage.mockResolvedValueOnce(undefined);
    const { rejectTrack } = await import("./processTracks");
    await expect(rejectTrack("missing")).rejects.toThrow("Track not found");

    mockGetTrackFromStorage.mockResolvedValueOnce({
      id: "bad-1",
      originalPath: "",
      metadata: {},
    });
    await expect(rejectTrack("bad-1")).rejects.toThrow("no original file");
  });

  it("uploadToFtp uploads processed file and marks track as uploaded", async () => {
    const track = {
      id: "track-1",
      filename: "Artist - Song.mp3",
      processedPath: "track-1/processed.mp3",
      status: "processed",
      metadata: { genre: "Средний", year: 2025, rating: 4 },
    };
    mockGetTrackFromStorage.mockResolvedValue(track);
    mockUploadToFtpImpl.mockResolvedValue(undefined);
    mockGenerateSafeFilename.mockReturnValue("Artist - Song.mp3");
    mockNormalizeForMatch.mockReturnValue("artist - song");
    mockAddRadioTrack.mockResolvedValue(undefined);
    const { uploadToFtp } = await import("./processTracks");

    await uploadToFtp("track-1", {
      host: "ftp.example.com",
      user: "radio",
      password: "secret",
      port: 21,
      secure: false,
    });

    expect(mockUploadToFtpImpl).toHaveBeenCalledWith(
      "track-1/processed.mp3",
      expect.objectContaining({ host: "ftp.example.com" }),
      track.metadata,
      "track-1"
    );
    expect(mockAddRadioTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedName: "artist - song",
        rawName: "Artist - Song.mp3",
        source: "ftp_upload",
      })
    );
    expect(mockSetTrack).toHaveBeenLastCalledWith(
      "track-1",
      expect.objectContaining({ status: "uploaded" })
    );
  });

  it("uploadToFtp marks track as error and rethrows when ftp upload fails", async () => {
    const track = {
      id: "track-2",
      filename: "Fail.mp3",
      processedPath: "track-2/processed.mp3",
      status: "processed",
      metadata: { genre: "Средний", year: 2026, rating: 3 },
    };
    mockGetTrackFromStorage.mockResolvedValue(track);
    mockUploadToFtpImpl.mockRejectedValue(new Error("ftp failed"));
    const { uploadToFtp } = await import("./processTracks");

    await expect(
      uploadToFtp("track-2", {
        host: "ftp.example.com",
        user: "radio",
        password: "secret",
      })
    ).rejects.toThrow("ftp failed");

    expect(mockSetTrack).toHaveBeenLastCalledWith(
      "track-2",
      expect.objectContaining({ status: "error", error: "ftp failed" })
    );
  });

  it("uploadToFtp validates track existence and processed path", async () => {
    mockGetTrackFromStorage.mockResolvedValueOnce(undefined);
    const { uploadToFtp } = await import("./processTracks");
    await expect(
      uploadToFtp("no-track", {
        host: "ftp.example.com",
        user: "radio",
        password: "secret",
      })
    ).rejects.toThrow("Track not found");

    mockGetTrackFromStorage.mockResolvedValueOnce({
      id: "no-processed",
      filename: "Song.mp3",
      status: "downloaded",
      metadata: {},
    });
    await expect(
      uploadToFtp("no-processed", {
        host: "ftp.example.com",
        user: "radio",
        password: "secret",
      })
    ).rejects.toThrow("Processed path is missing");
  });

  it("uploadLocalTrack uploads buffer to downloads and stores metadata", async () => {
    mockGenerateTrackId.mockReturnValue("local-1");
    mockSanitizeFilenameForStorage.mockReturnValue("Some Song.mp3");
    const { uploadLocalTrack } = await import("./processTracks");

    const track = await uploadLocalTrack(
      Buffer.from("audio"),
      "Some Song.mp3",
      "audio/mp3"
    );

    expect(track).toEqual(
      expect.objectContaining({
        id: "local-1",
        filename: "Some Song.mp3",
        originalPath: "local-1/Some Song.mp3",
        status: "downloaded",
      })
    );
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "local-1/Some Song.mp3",
      expect.any(Buffer),
      { contentType: "audio/mp3", upsert: true }
    );
    expect(mockSetTrack).toHaveBeenCalledWith(
      "local-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          title: "Some Song",
          rating: 5,
          year: 2026,
        }),
      })
    );
  });

  it("downloadTrack stores downloaded youtube track from RapidAPI", async () => {
    mockGenerateTrackId.mockReturnValue("yt-1");
    const { downloadTrack } = await import("./processTracks");

    const track = await downloadTrack("https://youtube.com/watch?v=1", "youtube");

    expect(track).toEqual(
      expect.objectContaining({
        id: "yt-1",
        filename: "Artist - Song.mp3",
        originalPath: "yt-1/Artist - Song.mp3",
        status: "downloaded",
      })
    );
    expect(mockDownloadTrackViaRapidAPI).toHaveBeenCalledWith(
      "https://youtube.com/watch?v=1",
      "/tmp/downloads",
      "yt-1"
    );
    expect(mockSetTrack).toHaveBeenCalledWith(
      "yt-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          sourceUrl: "https://youtube.com/watch?v=1",
          sourceType: "youtube",
          title: "Artist - Song",
        }),
      })
    );
  });

  it("downloadTrack throws source-specific error for youtube on serverless RapidAPI failure", async () => {
    mockDownloadTrackViaRapidAPI.mockRejectedValue(new Error("rapidapi down"));
    mockIsServerlessEnvironment.mockReturnValue(true);
    const { downloadTrack } = await import("./processTracks");

    await expect(
      downloadTrack("https://youtube.com/watch?v=2", "youtube")
    ).rejects.toThrow("RapidAPI");
  });

  it("downloadTrack fails when RapidAPI fails and ffmpeg is not available locally", async () => {
    mockDownloadTrackViaRapidAPI.mockRejectedValue(new Error("rapidapi down"));
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockFindFfmpegPath.mockResolvedValue(null);
    const { downloadTrack } = await import("./processTracks");

    await expect(
      downloadTrack("https://youtube.com/watch?v=3", "youtube")
    ).rejects.toThrow("FFmpeg");
  });

  it("downloadTrack fails when RapidAPI fails and yt-dlp is missing", async () => {
    mockDownloadTrackViaRapidAPI.mockRejectedValue(new Error("rapidapi down"));
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockGetYtDlpPath.mockResolvedValue(null);
    const { downloadTrack } = await import("./processTracks");

    await expect(
      downloadTrack("https://youtube.com/watch?v=4", "youtube")
    ).rejects.toThrow("yt-dlp");
  });

  it("downloadTrack throws for unknown source type", async () => {
    const { downloadTrack } = await import("./processTracks");

    await expect(
      downloadTrack("https://example.com", "soundcloud" as never)
    ).rejects.toThrow("Unknown source type");
  });

  it("downloadTrack falls back to yt-dlp for youtube-music when RapidAPI fails locally", async () => {
    mockGenerateTrackId.mockReturnValue("ytm-1");
    mockDownloadTrackViaRapidAPI.mockRejectedValue(new Error("rapidapi failed"));
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockGetYtDlpPath.mockResolvedValue("/usr/bin/yt-dlp");
    mockFsReaddir
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["Artist - Fallback.mp3"])
      .mockResolvedValueOnce(["cover.webp", "meta.json"]);
    mockFsReadFile.mockResolvedValue(Buffer.from("audio-bytes"));

    mockSpawn.mockImplementation(() => {
      const callbacks: Record<string, (arg?: unknown) => void> = {};
      const child = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          callbacks[event] = cb;
          return child;
        }),
      };
      queueMicrotask(() => callbacks.close?.(0));
      return child;
    });

    const { downloadTrack } = await import("./processTracks");
    const track = await downloadTrack(
      "https://music.youtube.com/watch?v=fallback",
      "youtube-music"
    );

    expect(mockSpawn).toHaveBeenCalled();
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "ytm-1/Artist - Fallback.mp3",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
    expect(track.originalPath).toBe("ytm-1/Artist - Fallback.mp3");
    expect(track.status).toBe("downloaded");
  });

  it("downloadTrackViaYtDlp rejects in serverless mode", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);
    const { downloadTrackViaYtDlp } = await import("./processTracks");

    await expect(
      downloadTrackViaYtDlp("https://youtube.com/watch?v=1", "/tmp/downloads", "srv-1")
    ).rejects.toThrow("not supported in serverless");
  });

  it("downloadTrackViaYtDlp rejects when yt-dlp is missing", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGetYtDlpPath.mockResolvedValue(null);
    const { downloadTrackViaYtDlp } = await import("./processTracks");

    await expect(
      downloadTrackViaYtDlp("https://youtube.com/watch?v=2", "/tmp/downloads", "ydl-1")
    ).rejects.toThrow("yt-dlp not found");
  });

  it("downloadTrackViaYtDlp rejects when process exits with ffmpeg error", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGetYtDlpPath.mockResolvedValue("/usr/bin/yt-dlp");
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockFsReaddir.mockResolvedValue([]);

    mockSpawn.mockImplementation(() => {
      const closeHandlers: Array<(code: number) => void> = [];
      const stderrHandlers: Array<(chunk: Buffer) => void> = [];
      const child = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
            if (event === "data") stderrHandlers.push(cb);
          }),
        },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === "close") closeHandlers.push(cb);
          return child;
        }),
      };
      queueMicrotask(() => {
        stderrHandlers.forEach((h) => h(Buffer.from("ffmpeg not found")));
        closeHandlers.forEach((h) => h(1));
      });
      return child;
    });

    const { downloadTrackViaYtDlp } = await import("./processTracks");

    await expect(
      downloadTrackViaYtDlp("https://youtube.com/watch?v=3", "/tmp/downloads", "ydl-2")
    ).rejects.toThrow("FFmpeg");
  });

  it("downloadTrackViaYtDlp rejects when no mp3 file is produced", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGetYtDlpPath.mockResolvedValue("/usr/bin/yt-dlp");
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockFsReaddir
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockSpawn.mockImplementation(() => {
      const callbacks: Record<string, (arg?: unknown) => void> = {};
      const child = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          callbacks[event] = cb;
          return child;
        }),
      };
      queueMicrotask(() => callbacks.close?.(0));
      return child;
    });

    const { downloadTrackViaYtDlp } = await import("./processTracks");
    await expect(
      downloadTrackViaYtDlp("https://youtube.com/watch?v=no-mp3", "/tmp/downloads", "ydl-3")
    ).rejects.toThrow("MP3");
  });

  it("downloadTrackViaYtDlp rejects when spawn emits error", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGetYtDlpPath.mockResolvedValue("/usr/bin/yt-dlp");
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockFsReaddir.mockResolvedValue([]);

    mockSpawn.mockImplementation(() => {
      const callbacks: Record<string, (arg?: unknown) => void> = {};
      const child = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          callbacks[event] = cb;
          return child;
        }),
      };
      queueMicrotask(() => callbacks.error?.(new Error("spawn fail")));
      return child;
    });

    const { downloadTrackViaYtDlp } = await import("./processTracks");
    await expect(
      downloadTrackViaYtDlp("https://youtube.com/watch?v=spawn", "/tmp/downloads", "ydl-4")
    ).rejects.toThrow("yt-dlp");
  });

  it("trimTrack processes file, uploads processed version and marks trimmed", async () => {
    mockGetTrackFromStorage.mockResolvedValue({
      id: "trim-1",
      filename: "Trim Me.mp3",
      originalPath: "trim-1/original.mp3",
      status: "downloaded",
      metadata: { title: "Trim Me" },
    });
    const { trimTrack } = await import("./processTracks");
    const trimSettings = { startTime: 5, fadeIn: 1, fadeOut: 1, maxDuration: 120 };

    const track = await trimTrack("trim-1", trimSettings);

    expect(mockProcessAudioFile).toHaveBeenCalledWith(
      "/tmp/downloads/trim-1_temp_trim_input.mp3",
      "/tmp/processed/trim-1_trimmed_Trim Me.mp3",
      trimSettings,
      360
    );
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "processed-bucket",
      "trim-1/Trim Me.mp3",
      expect.any(Buffer),
      { contentType: "audio/mpeg", upsert: true }
    );
    expect(track).toEqual(
      expect.objectContaining({
        status: "trimmed",
        processedPath: "trim-1/Trim Me.mp3",
        metadata: expect.objectContaining({ isTrimmed: true }),
      })
    );
  });

  it("processTrack with existing processed path updates metadata/tags only", async () => {
    mockGetTrackFromStorage.mockResolvedValue({
      id: "proc-1",
      filename: "Processed.mp3",
      originalPath: "proc-1/original.mp3",
      processedPath: "proc-1/processed.mp3",
      status: "processed",
      metadata: { title: "Old", artist: "Unknown" },
    });
    const { processTrack } = await import("./processTracks");

    const track = await processTrack("proc-1", { title: "New Title" });

    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith(
      "processed-bucket",
      "proc-1/processed.mp3"
    );
    expect(mockWriteTrackTags).toHaveBeenCalledWith(
      "/tmp/processed/proc-1_tags.mp3",
      expect.objectContaining({ title: "New Title" })
    );
    expect(mockSetTrack).toHaveBeenCalledWith(
      "proc-1",
      expect.objectContaining({ metadata: expect.objectContaining({ title: "New Title" }) })
    );
    expect(track.metadata.title).toBe("New Title");
  });

  it("processTrack full flow updates bpm/genre and stores processed path", async () => {
    mockGetTrackFromStorage.mockResolvedValue({
      id: "proc-2",
      filename: "Need Process.mp3",
      originalPath: "proc-2/original.mp3",
      status: "downloaded",
      metadata: { title: "Need Process", genre: "Средний" },
    });
    mockDetectBpmNetlify.mockResolvedValue(140);
    const { processTrack } = await import("./processTracks");
    const trimSettings = { startTime: 1, fadeIn: 0, fadeOut: 0 };

    const track = await processTrack(
      "proc-2",
      { artist: "New Artist" },
      trimSettings
    );

    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "proc-2/original.mp3"
    );
    expect(mockProcessAudioFile).toHaveBeenCalledWith(
      "/tmp/downloads/proc-2_temp_input.mp3",
      "/tmp/processed/proc-2_Need Process.mp3",
      trimSettings,
      360
    );
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "processed-bucket",
      "proc-2/Need Process.mp3",
      expect.any(Buffer),
      { contentType: "audio/mpeg", upsert: true }
    );
    expect(track).toEqual(
      expect.objectContaining({
        status: "processed",
        processedPath: "proc-2/Need Process.mp3",
        metadata: expect.objectContaining({
          bpm: 140,
          genre: "Быстрый",
          artist: "New Artist",
          isTrimmed: true,
        }),
      })
    );
  });
});
