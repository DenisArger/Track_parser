import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadToFtp } from "./ftpUploader";

const mockGenerateSafeFilename = vi.fn();
const mockLoadConfig = vi.fn();
const mockDownloadFileFromStorage = vi.fn();
const mockPathExists = vi.fn();
const mockStat = vi.fn();
const mockEnsureDir = vi.fn();
const mockWriteFile = vi.fn();
const mockRemove = vi.fn();

const mockClientAccess = vi.fn();
const mockClientEnsureDir = vi.fn();
const mockClientCd = vi.fn();
const mockClientUploadFrom = vi.fn();
const mockClientSize = vi.fn();
const mockClientClose = vi.fn();

vi.mock("@/lib/utils/filenameUtils", () => ({
  generateSafeFilename: (...args: unknown[]) => mockGenerateSafeFilename(...args),
}));

vi.mock("@/lib/config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  downloadFileFromStorage: (...args: unknown[]) =>
    mockDownloadFileFromStorage(...args),
  STORAGE_BUCKETS: {
    downloads: "downloads",
    processed: "processed",
    rejected: "rejected",
  },
}));

vi.mock("fs-extra", () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  default: {
    pathExists: (...args: unknown[]) => mockPathExists(...args),
    stat: (...args: unknown[]) => mockStat(...args),
    ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

vi.mock("basic-ftp", () => ({
  Client: class {
    access(config: unknown) {
      return mockClientAccess(config);
    }
    ensureDir(dir: string) {
      return mockClientEnsureDir(dir);
    }
    cd(dir: string) {
      return mockClientCd(dir);
    }
    uploadFrom(localPath: string, remoteName: string) {
      return mockClientUploadFrom(localPath, remoteName);
    }
    size(remoteName: string) {
      return mockClientSize(remoteName);
    }
    close() {
      mockClientClose();
    }
  },
}));

describe("uploadToFtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGenerateSafeFilename.mockReturnValue("Artist - Song.mp3");
    mockLoadConfig.mockResolvedValue({ folders: { server_upload: "/tmp/upload" } });
    mockDownloadFileFromStorage.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockPathExists.mockResolvedValue(true);
    mockStat.mockResolvedValue({ size: 3 });
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    mockClientAccess.mockResolvedValue(undefined);
    mockClientEnsureDir.mockResolvedValue(undefined);
    mockClientCd.mockResolvedValue(undefined);
    mockClientUploadFrom.mockResolvedValue(undefined);
    mockClientSize.mockResolvedValue(3);
  });

  const ftpConfig = {
    host: "ftp.example.com",
    port: 21,
    user: "u",
    password: "p",
    secure: false,
    remotePath: "/radio/music",
  };

  it("uploads local file using metadata filename", async () => {
    await uploadToFtp(
      "/tmp/local.mp3",
      ftpConfig,
      { artist: "Artist", title: "Song" } as never
    );

    expect(mockClientAccess).toHaveBeenCalled();
    expect(mockClientEnsureDir).toHaveBeenCalledWith("/radio/music");
    const uploadedPath = mockClientUploadFrom.mock.calls[0][0] as string;
    expect(uploadedPath).toContain("/tmp/upload/temp_");
    expect(uploadedPath).toContain("_local.mp3");
    expect(mockClientUploadFrom.mock.calls[0][1]).toBe("Artist - Song.mp3");
    expect(mockClientClose).toHaveBeenCalled();
  });

  it("downloads file from Storage and uploads temp file", async () => {
    await uploadToFtp("processed/abc.mp3", ftpConfig, undefined, "trk1");

    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith("processed", "abc.mp3");
    expect(mockEnsureDir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockClientUploadFrom).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("tries alternative storage path for track-prefixed names", async () => {
    mockDownloadFileFromStorage
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce(Buffer.from([1, 2, 3]));

    await uploadToFtp("processed/trk1_song.mp3", ftpConfig, undefined, "trk1");

    expect(mockDownloadFileFromStorage).toHaveBeenNthCalledWith(
      1,
      "processed",
      "trk1_song.mp3"
    );
    expect(mockDownloadFileFromStorage).toHaveBeenNthCalledWith(
      2,
      "processed",
      "trk1/song.mp3"
    );
  });

  it("throws when file does not exist", async () => {
    mockPathExists.mockResolvedValueOnce(false);

    await expect(uploadToFtp("/tmp/missing.mp3", ftpConfig)).rejects.toThrow(
      /File not found: .*missing\.mp3/
    );
  });

  it("falls back to cd when ensureDir fails and throws when cd fails", async () => {
    mockClientEnsureDir.mockRejectedValueOnce(new Error("ensure dir fail"));
    mockClientCd.mockRejectedValueOnce(new Error("cd fail"));

    await expect(uploadToFtp("/tmp/local.mp3", ftpConfig)).rejects.toThrow(
      'FTP upload failed: Failed to access remote directory "/radio/music": cd fail'
    );
  });

  it("wraps FTP upload errors", async () => {
    mockClientUploadFrom.mockRejectedValueOnce(new Error("network drop"));

    await expect(uploadToFtp("/tmp/local.mp3", ftpConfig)).rejects.toThrow(
      "FTP upload failed: network drop"
    );
    expect(mockClientClose).toHaveBeenCalled();
  });
});
