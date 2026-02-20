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

  const mod = await import("./ffmpegFinder");
  return { findFfmpegPath: mod.findFfmpegPath, pathExists };
}

describe("findFfmpegPath", () => {
  afterEach(() => {
    delete process.env.FFMPEG_PATH;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns null in serverless environment", async () => {
    const { findFfmpegPath } = await loadFinder({ serverless: true });
    await expect(findFfmpegPath()).resolves.toBeNull();
  });

  it("returns local bin directory when ffmpeg and ffprobe exist", async () => {
    const binDir = "/project/bin";
    const ffmpeg = exePath(binDir, "ffmpeg");
    const ffprobe = exePath(binDir, "ffprobe");

    const { findFfmpegPath } = await loadFinder({
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(findFfmpegPath()).resolves.toBe(binDir);
  });

  it("uses FFMPEG_PATH environment variable when valid", async () => {
    const envDir = "/custom/ffmpeg/bin";
    process.env.FFMPEG_PATH = envDir;
    const ffmpeg = exePath(envDir, "ffmpeg");
    const ffprobe = exePath(envDir, "ffprobe");

    const { findFfmpegPath } = await loadFinder({
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(findFfmpegPath()).resolves.toBe(envDir);
  });

  it("uses config ffmpeg.path when valid", async () => {
    const configDir = "/cfg/ffmpeg/bin";
    const ffmpeg = exePath(configDir, "ffmpeg");
    const ffprobe = exePath(configDir, "ffprobe");

    const { findFfmpegPath } = await loadFinder({
      configValue: { ffmpeg: { path: configDir } },
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(findFfmpegPath()).resolves.toBe(configDir);
  });

  it("resolves directory from PATH lookup", async () => {
    const executable = process.platform === "win32" ? "C:\\ffmpeg\\bin\\ffmpeg.exe" : "/usr/bin/ffmpeg";
    const expectedDir = path.dirname(executable);

    const { findFfmpegPath } = await loadFinder({
      configValue: {},
      execAsyncImpl: async () => ({ stdout: `${executable}\n` }),
      pathExistsImpl: (filePath) => filePath === executable,
    });

    await expect(findFfmpegPath()).resolves.toBe(expectedDir);
  });

  it("falls back to common paths when PATH lookup fails", async () => {
    const commonDir = process.platform === "win32" ? "C:\\ffmpeg\\bin" : "/usr/local/bin";
    const ffmpeg = exePath(commonDir, "ffmpeg");
    const ffprobe = exePath(commonDir, "ffprobe");

    const { findFfmpegPath } = await loadFinder({
      execAsyncImpl: async () => {
        throw new Error("which failed");
      },
      pathExistsImpl: (filePath) => filePath === ffmpeg || filePath === ffprobe,
    });

    await expect(findFfmpegPath()).resolves.toBe(commonDir);
  });

  it("uses alternative PATH lookup when previous checks fail", async () => {
    const altExecutable = process.platform === "win32" ? "C:\\opt\\ffmpeg\\ffmpeg.exe" : "/opt/bin/ffmpeg";
    const altDir = path.dirname(altExecutable);
    let callCount = 0;

    const { findFfmpegPath } = await loadFinder({
      execAsyncImpl: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("first lookup failed");
        }
        return { stdout: `${altExecutable}\n` };
      },
      pathExistsImpl: (filePath) => filePath === altDir,
    });

    await expect(findFfmpegPath()).resolves.toBe(altDir);
  });
});
