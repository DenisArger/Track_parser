import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig, saveConfig, type AppConfig } from "./config";

const mockPathExists = vi.fn();
const mockReadJson = vi.fn();
const mockEnsureDir = vi.fn();
const mockWriteJson = vi.fn();

const mockIsServerlessEnvironment = vi.fn();
const mockGetSafeWorkingDirectory = vi.fn();

vi.mock("fs-extra", () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
}));

vi.mock("@/lib/utils/environment", () => ({
  isServerlessEnvironment: (...args: unknown[]) =>
    mockIsServerlessEnvironment(...args),
  getSafeWorkingDirectory: (...args: unknown[]) =>
    mockGetSafeWorkingDirectory(...args),
}));

describe("config module", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PHASE;
    delete process.env.NETLIFY;
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.FTP_HOST;
    delete process.env.FTP_PORT;
    delete process.env.FTP_USER;
    delete process.env.FTP_PASSWORD;
    delete process.env.RAPIDAPI_KEY;
    delete process.env.RAPIDAPI_HOST;
    delete process.env.FFMPEG_PATH;
    delete process.env.TMPDIR;
    delete process.env.TMP;

    mockPathExists.mockResolvedValue(false);
    mockReadJson.mockResolvedValue({});
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteJson.mockResolvedValue(undefined);
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGetSafeWorkingDirectory.mockReturnValue("/work");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("loadConfig returns defaults during production build phase", async () => {
    process.env.NEXT_PHASE = "phase-production-build";

    const cfg = await loadConfig();

    expect(cfg.folders.downloads).toBe("downloads");
    expect(cfg.processing.maxDuration).toBe(360);
    expect(mockPathExists).not.toHaveBeenCalled();
  });

  it("loadConfig returns defaults when config file is missing", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockPathExists.mockResolvedValue(false);

    const cfg = await loadConfig();

    expect(cfg.folders).toEqual({
      downloads: "downloads",
      processed: "processed",
      rejected: "rejected",
      server_upload: "server_upload",
    });
  });

  it("loadConfig reads config.json and uses env overrides", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadJson.mockResolvedValue({
      folders: {
        downloads: "/d",
        processed: "/p",
        rejected: "/r",
        server_upload: "/s",
      },
      processing: { maxDuration: 300, defaultRating: 4, defaultYear: 2024 },
      audio: { bitrate: "128k", sampleRate: 48000 },
      rapidapi: { key: "cfg-key", host: "cfg-host" },
      ffmpeg: { path: "/cfg/ffmpeg" },
    });
    process.env.FTP_HOST = "ftp.example.com";
    process.env.FTP_PORT = "2121";
    process.env.FTP_USER = "radio";
    process.env.FTP_PASSWORD = "secret";
    process.env.RAPIDAPI_KEY = "env-key";
    process.env.FFMPEG_PATH = "/env/ffmpeg";

    const cfg = await loadConfig();

    expect(cfg.folders.downloads).toBe("/d");
    expect(cfg.ftp).toEqual(
      expect.objectContaining({
        host: "ftp.example.com",
        port: 2121,
        user: "radio",
        password: "secret",
      })
    );
    expect(cfg.processing.maxDuration).toBe(300);
    expect(cfg.rapidapi.key).toBe("env-key");
    expect(cfg.ffmpeg?.path).toBe("/env/ffmpeg");
    expect(mockEnsureDir).toHaveBeenCalledWith("/d");
    expect(mockEnsureDir).toHaveBeenCalledWith("/p");
    expect(mockEnsureDir).toHaveBeenCalledWith("/r");
    expect(mockEnsureDir).toHaveBeenCalledWith("/s");
  });

  it("loadConfig uses /tmp folders in serverless when config exists", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);
    process.env.TMPDIR = "/custom-tmp";
    mockPathExists.mockResolvedValue(true);
    mockReadJson.mockResolvedValue({
      folders: {
        downloads: "downloads",
        processed: "processed",
        rejected: "rejected",
        server_upload: "server_upload",
      },
    });

    const cfg = await loadConfig();

    expect(cfg.folders.downloads).toBe("/custom-tmp/downloads");
    expect(cfg.folders.processed).toBe("/custom-tmp/processed");
    expect(cfg.folders.rejected).toBe("/custom-tmp/rejected");
  });

  it("loadConfig falls back to tmp config path in serverless", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);
    mockGetSafeWorkingDirectory.mockReturnValue("/tmp");
    mockPathExists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mockReadJson.mockResolvedValue({
      processing: { maxDuration: 240, defaultRating: 3, defaultYear: 2023 },
    });

    const cfg = await loadConfig();

    expect(cfg.processing.maxDuration).toBe(240);
    expect(mockPathExists).toHaveBeenNthCalledWith(1, expect.stringContaining("config.json"));
    expect(mockPathExists).toHaveBeenNthCalledWith(2, "/tmp/config.json");
  });

  it("loadConfig returns defaults when config exists but read fails", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadJson.mockRejectedValue(new Error("bad json"));

    const cfg = await loadConfig();

    expect(cfg.folders.downloads).toBe("downloads");
    expect(cfg.processing.maxDuration).toBe(360);
  });

  it("loadConfig tolerates ensureDir failures", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadJson.mockResolvedValue({
      folders: {
        downloads: "/d",
        processed: "/p",
        rejected: "/r",
        server_upload: "/s",
      },
      processing: { maxDuration: 300, defaultRating: 4, defaultYear: 2024 },
      audio: { bitrate: "128k", sampleRate: 48000 },
      rapidapi: { key: "cfg-key", host: "cfg-host" },
      ffmpeg: { path: "/cfg/ffmpeg" },
    });
    mockEnsureDir
      .mockRejectedValueOnce(new Error("mkdir /d"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("mkdir /r"))
      .mockResolvedValueOnce(undefined);

    const cfg = await loadConfig();

    expect(cfg.folders.downloads).toBe("/d");
    expect(mockEnsureDir).toHaveBeenCalledTimes(4);
  });

  it("saveConfig skips file write in serverless", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);

    await saveConfig({} as AppConfig);

    expect(mockWriteJson).not.toHaveBeenCalled();
  });

  it("saveConfig writes config.json in working directory", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockGetSafeWorkingDirectory.mockReturnValue("/repo");
    const cfg = {
      folders: {
        downloads: "downloads",
        processed: "processed",
        rejected: "rejected",
        server_upload: "server_upload",
      },
    } as AppConfig;

    await saveConfig(cfg);

    expect(mockWriteJson).toHaveBeenCalledWith("/repo/config.json", cfg, { spaces: 2 });
  });

  it("saveConfig handles write errors without throwing", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockWriteJson.mockRejectedValue(new Error("disk full"));

    await expect(saveConfig({} as AppConfig)).resolves.toBeUndefined();
  });
});
