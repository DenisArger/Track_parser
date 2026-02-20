import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

type YtOptions = {
  serverless?: boolean;
  cwd?: string;
  cwdThrows?: boolean;
  pathExistsImpl?: (filePath: string) => boolean | Promise<boolean>;
  execAsyncImpl?: () => Promise<{ stdout: string }>;
};

function ytName() {
  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

async function loadYtDlp(options: YtOptions = {}) {
  vi.resetModules();

  const {
    serverless = false,
    cwd = "/project",
    cwdThrows = false,
    pathExistsImpl = async () => false,
    execAsyncImpl = async () => {
      throw new Error("not found");
    },
  } = options;

  const pathExists = vi.fn(pathExistsImpl);
  const execAsync = vi.fn(execAsyncImpl);

  vi.doMock("./environment", () => ({
    isServerlessEnvironment: () => serverless,
  }));
  vi.doMock("fs-extra", () => ({
    pathExists,
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

  const mod = await import("./ytDlpFinder");
  return { getYtDlpPath: mod.getYtDlpPath };
}

describe("getYtDlpPath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns null in serverless environment", async () => {
    const { getYtDlpPath } = await loadYtDlp({ serverless: true });
    await expect(getYtDlpPath()).resolves.toBeNull();
  });

  it("returns bundled binary from local bin directory", async () => {
    const expected = path.join("/project/bin", ytName());
    const { getYtDlpPath } = await loadYtDlp({
      pathExistsImpl: (filePath) => filePath === expected,
    });

    await expect(getYtDlpPath()).resolves.toBe(expected);
  });

  it("uses /tmp when process.cwd() throws", async () => {
    const expected = path.join("/tmp/bin", ytName());
    const { getYtDlpPath } = await loadYtDlp({
      cwdThrows: true,
      pathExistsImpl: (filePath) => filePath === expected,
    });

    await expect(getYtDlpPath()).resolves.toBe(expected);
  });

  it("falls back to PATH lookup on non-windows", async () => {
    if (process.platform === "win32") {
      return;
    }

    const inPath = "/usr/local/bin/yt-dlp";
    const { getYtDlpPath } = await loadYtDlp({
      execAsyncImpl: async () => ({ stdout: `${inPath}\n` }),
      pathExistsImpl: (filePath) => filePath === inPath,
    });

    await expect(getYtDlpPath()).resolves.toBe(inPath);
  });

  it("returns null and logs warning when lookup throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getYtDlpPath } = await loadYtDlp({
      pathExistsImpl: () => {
        throw new Error("fs failed");
      },
    });

    await expect(getYtDlpPath()).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
