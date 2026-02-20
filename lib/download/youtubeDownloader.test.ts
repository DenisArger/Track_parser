import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { downloadTrackViaRapidAPI, extractVideoId } from "./youtubeDownloader";

const mockEnsureDir = vi.fn();
const mockWriteFile = vi.fn();
const mockRemove = vi.fn();
const mockLoadConfig = vi.fn();
const mockUploadFileToStorage = vi.fn();
const mockSanitizeFilenameForStorage = vi.fn();

vi.mock("axios");

vi.mock("fs-extra", () => ({
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
}));

vi.mock("@/lib/config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  uploadFileToStorage: (...args: unknown[]) => mockUploadFileToStorage(...args),
  STORAGE_BUCKETS: { downloads: "downloads" },
  sanitizeFilenameForStorage: (...args: unknown[]) =>
    mockSanitizeFilenameForStorage(...args),
}));

describe("youtubeDownloader", () => {
  const mockedAxios = vi.mocked(axios, true);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockLoadConfig.mockResolvedValue({
      rapidapi: { key: "k", host: "h" },
    });
    mockSanitizeFilenameForStorage.mockReturnValue("safe.mp3");
    mockUploadFileToStorage.mockResolvedValue({ path: "trk1/safe.mp3" });

    mockedAxios.request.mockResolvedValue({
      data: { status: "ok", link: "https://cdn/audio", title: "Title" },
    } as never);
    mockedAxios.get.mockResolvedValue({
      data: Buffer.from([1, 2, 3]),
    } as never);
  });

  it("extractVideoId parses supported youtube urls", () => {
    expect(
      extractVideoId("https://www.youtube.com/watch?v=abc123&list=ignored")
    ).toBe("abc123");
    expect(extractVideoId("https://music.youtube.com/watch?v=zzz999")).toBe(
      "zzz999"
    );
    expect(extractVideoId("https://youtu.be/QWE123")).toBe("QWE123");
    expect(extractVideoId("https://youtube.com/embed/EMB777")).toBe("EMB777");
  });

  it("extractVideoId throws on playlist and invalid URLs", () => {
    expect(() =>
      extractVideoId("https://youtube.com/playlist?list=PL123")
    ).toThrow("Плейлисты не поддерживаются");
    expect(() => extractVideoId("https://example.com/not-youtube")).toThrow(
      "Invalid YouTube URL"
    );
  });

  it("downloadTrackViaRapidAPI throws when output directory cannot be created", async () => {
    mockEnsureDir.mockRejectedValue(new Error("no permissions"));

    await expect(
      downloadTrackViaRapidAPI("https://youtube.com/watch?v=abc", "/tmp/out")
    ).rejects.toThrow("Failed to create output directory: no permissions");
  });

  it("downloadTrackViaRapidAPI throws on RapidAPI fail status", async () => {
    mockedAxios.request.mockResolvedValue({
      data: { status: "fail", msg: "quota exceeded" },
    } as never);

    await expect(
      downloadTrackViaRapidAPI("https://youtube.com/watch?v=abc", "/tmp/out")
    ).rejects.toThrow("RapidAPI error: quota exceeded");
  });

  it("downloadTrackViaRapidAPI throws when link is missing", async () => {
    mockedAxios.request.mockResolvedValue({
      data: { status: "ok", title: "No link title" },
    } as never);

    await expect(
      downloadTrackViaRapidAPI("https://youtube.com/watch?v=abc", "/tmp/out")
    ).rejects.toThrow("No download link received from RapidAPI");
  });

  it("downloadTrackViaRapidAPI downloads, uploads and cleans temp file", async () => {
    vi.spyOn(Date, "now").mockReturnValue(111);

    const result = await downloadTrackViaRapidAPI(
      "https://youtube.com/watch?v=abc123",
      "/tmp/out",
      "trk1"
    );

    expect(mockSanitizeFilenameForStorage).toHaveBeenCalledWith("Title.mp3");
    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/out/safe.mp3", expect.any(Buffer));
    expect(mockUploadFileToStorage).toHaveBeenCalledWith(
      "downloads",
      "trk1/safe.mp3",
      expect.any(Buffer),
      { contentType: "audio/mpeg", upsert: true }
    );
    expect(mockRemove).toHaveBeenCalledWith("/tmp/out/safe.mp3");
    expect(result).toEqual({
      filePath: "trk1/safe.mp3",
      title: "Title",
      storagePath: "trk1/safe.mp3",
    });
  });
});
