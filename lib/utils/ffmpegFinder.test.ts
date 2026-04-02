import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

type FinderOptions = {
  serverless?: boolean;
  cwd?: string;
  cwdThrows?: boolean;
  pathExistsImpl?: (filePath: string) => boolean | Promise<boolean>;
  configValue?: unknown;
  configThrows?: boolean;
  execAsyncImpl?: () => Promise<{ stdout: string }>;
};

function exeName(base: string) {
  return process.platform === "win32" ? `${base}.exe` : base;
}

function exePath(dir: string, base: string) {
  return path.join(dir, exeName(base));
}

async function loadFinder(options: FinderOptions = {}) {
  vi.resetModules();

  const {
    serverless = false,
    cwd = "/project",
    cwdThrows = false,
    pathExistsImpl = async () => false,
    configValue = {},
    configThrows = false,
    execAsyncImpl = async () => {
      throw new Error("not found");
    },
  } = options;

  const pathExists = vi.fn(pathExistsImpl);
  const chmod = vi.fn(async () => undefined);
  const loadConfig = configThrows
    ? vi.fn(async () => {
        throw new Error("config error");
      })
    : vi.fn(async () => configValue);
  const execAsync = vi.fn(execAsyncImpl);

  vi.doMock("./environment", () => ({
    isServerlessEnvironment: () => serverless,
  }));
  vi.doMock("fs-extra", () => ({
    pathExists,
    chmod,
  }));
  vi.doMock("@/lib/config", () => ({
    loadConfig,
  }));
  vi.doMock("child_process", () => ({
    exec: vi.fn(),
  }));
  vi.doMock("util", () => ({
    promisify: vi.fn(() => execAsync),
  }));

  if (cwdThrows) {
    vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("cwd failed");
    });
  } else {
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  }

  return import("./ffmpegFinder");
}

describe("ffmpegFinder", () => {
  afterEach(() => {
    delete process.env.FFMPEG_PATH;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns local bundled paths in serverless when binaries exist", async () => {
    const binDir = "/project/bin";
    const ffmpeg = exePath(binDir, "ffmpeg");
    const ffprobe = exePath(binDir, "ffprobe");

    const mod = await loadFinder({
      serverless: true,
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(mod.findFfmpegBinaryPaths()).resolves.toEqual({
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      source: "local-bin",
    });
  });

  it("returns null in serverless when bundled binaries are missing", async () => {
    const mod = await loadFinder({ serverless: true });
    await expect(mod.findFfmpegBinaryPaths()).resolves.toBeNull();
  });

  it("uses FFMPEG_PATH environment variable when valid", async () => {
    const envDir = "/custom/ffmpeg/bin";
    process.env.FFMPEG_PATH = envDir;
    const ffmpeg = exePath(envDir, "ffmpeg");
    const ffprobe = exePath(envDir, "ffprobe");

    const mod = await loadFinder({
      cwd: "/other-project",
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(mod.findFfmpegBinaryPaths()).resolves.toEqual({
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      source: "env",
    });
  });

  it("uses config ffmpeg.path when valid", async () => {
    const configDir = "/cfg/ffmpeg/bin";
    const ffmpeg = exePath(configDir, "ffmpeg");
    const ffprobe = exePath(configDir, "ffprobe");

    const mod = await loadFinder({
      cwd: "/other-project",
      configValue: { ffmpeg: { path: configDir } },
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(mod.findFfmpegBinaryPaths()).resolves.toEqual({
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      source: "config",
    });
  });

  it("resolves binary pair from PATH lookup", async () => {
    const ffmpeg = process.platform === "win32" ? "C:\\ffmpeg\\bin\\ffmpeg.exe" : "/usr/bin/ffmpeg";
    const ffprobe = process.platform === "win32" ? "C:\\ffmpeg\\bin\\ffprobe.exe" : "/usr/bin/ffprobe";

    const mod = await loadFinder({
      cwd: "/other-project",
      execAsyncImpl: async () => ({ stdout: `${ffmpeg}\n` }),
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(mod.findFfmpegBinaryPaths()).resolves.toEqual({
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      source: "path",
    });
  });

  it("falls back to common paths when PATH lookup fails", async () => {
    const commonDir = process.platform === "win32" ? "C:\\ffmpeg\\bin" : "/usr/local/bin";
    const ffmpeg = exePath(commonDir, "ffmpeg");
    const ffprobe = exePath(commonDir, "ffprobe");

    const mod = await loadFinder({
      cwd: "/other-project",
      execAsyncImpl: async () => {
        throw new Error("which failed");
      },
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(mod.findFfmpegBinaryPaths()).resolves.toEqual({
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      source: "common-path",
    });
  });

  it("findFfmpegPath returns the ffmpeg directory", async () => {
    const binDir = "/project/bin";
    const ffmpeg = exePath(binDir, "ffmpeg");
    const ffprobe = exePath(binDir, "ffprobe");

    const mod = await loadFinder({
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(mod.findFfmpegPath()).resolves.toBe(binDir);
  });
});
