import { beforeEach, describe, expect, it, vi } from "vitest";
import { processAudioFile } from "./audioProcessor";

const mockCopy = vi.fn();
const mockChmod = vi.fn();
const mockIsServerlessEnvironment = vi.fn();
const mockProcessAudioFileWasm = vi.fn();
const mockFindFfmpegBinaryPaths = vi.fn();
const mockFfmpegFactory = vi.fn();

let mockInstallerPaths: { ffmpegPath: string; ffprobePath: string } | null = null;

vi.mock("fs-extra", () => ({
  copy: (...args: unknown[]) => mockCopy(...args),
  chmod: (...args: unknown[]) => mockChmod(...args),
}));

vi.mock("@/lib/utils/environment", () => ({
  isServerlessEnvironment: (...args: unknown[]) =>
    mockIsServerlessEnvironment(...args),
}));

vi.mock("./audioProcessorWasm", () => ({
  processAudioFileWasm: (...args: unknown[]) => mockProcessAudioFileWasm(...args),
}));

vi.mock("@/lib/utils/ffmpegFinder", () => ({
  findFfmpegBinaryPaths: (...args: unknown[]) => mockFindFfmpegBinaryPaths(...args),
}));

vi.mock("@ffmpeg-installer/ffmpeg", () => ({
  get default() {
    if (!mockInstallerPaths) {
      throw new Error("ffmpeg installer unavailable");
    }
    return { path: mockInstallerPaths.ffmpegPath };
  },
}));

vi.mock("@ffprobe-installer/ffprobe", () => ({
  get default() {
    if (!mockInstallerPaths) {
      throw new Error("ffprobe installer unavailable");
    }
    return { path: mockInstallerPaths.ffprobePath };
  },
}));

vi.mock("fluent-ffmpeg", () => ({
  default: (...args: unknown[]) => mockFfmpegFactory(...args),
}));

function createFfmpegCommand(behavior: "end" | "error" = "end") {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const cmd = {
    setStartTime: vi.fn().mockReturnThis(),
    duration: vi.fn().mockReturnThis(),
    audioFilters: vi.fn().mockReturnThis(),
    setFfmpegPath: vi.fn().mockReturnThis(),
    setFfprobePath: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
      return cmd;
    }),
    run: vi.fn(() => {
      if (behavior === "error") {
        handlers.error?.(new Error("ffmpeg failed"));
      } else {
        handlers.end?.();
      }
    }),
  };
  return cmd;
}

describe("audioProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockInstallerPaths = {
      ffmpegPath: "/installer/ffmpeg",
      ffprobePath: "/installer/ffprobe",
    };
    mockCopy.mockResolvedValue(undefined);
    mockChmod.mockResolvedValue(undefined);
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockResolvedValue(undefined);
    mockFindFfmpegBinaryPaths.mockResolvedValue({
      ffmpegPath: "/finder/ffmpeg",
      ffprobePath: "/finder/ffprobe",
      source: "local-bin",
    });
  });

  it("does not call wasm in serverless node runtime", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);
    const cmd = createFfmpegCommand("end");
    mockFfmpegFactory.mockReturnValue(cmd);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", {
      startTime: 0,
      fadeIn: 0,
      fadeOut: 0,
      maxDuration: 30,
    });

    expect(mockProcessAudioFileWasm).not.toHaveBeenCalled();
    expect(cmd.setFfmpegPath).toHaveBeenCalledWith("/installer/ffmpeg");
    expect(cmd.setFfprobePath).toHaveBeenCalledWith("/installer/ffprobe");
  });

  it("prefers installer paths when available", async () => {
    const cmd = createFfmpegCommand("end");
    mockFfmpegFactory.mockReturnValue(cmd);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", {
      startTime: 10,
      endTime: 40,
      fadeIn: 2,
      fadeOut: 3,
    });

    expect(mockFindFfmpegBinaryPaths).not.toHaveBeenCalled();
    expect(cmd.setFfmpegPath).toHaveBeenCalledWith("/installer/ffmpeg");
    expect(cmd.setFfprobePath).toHaveBeenCalledWith("/installer/ffprobe");
    expect(cmd.audioFilters).toHaveBeenCalledWith([
      "afade=t=in:st=0:d=2",
      "afade=t=out:st=27:d=3",
    ]);
  });

  it("falls back to finder when installer is unavailable", async () => {
    mockInstallerPaths = null;
    const cmd = createFfmpegCommand("end");
    mockFfmpegFactory.mockReturnValue(cmd);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", {
      startTime: 0,
      fadeIn: 0,
      fadeOut: 0,
      maxDuration: 30,
    });

    expect(mockFindFfmpegBinaryPaths).toHaveBeenCalled();
    expect(cmd.setFfmpegPath).toHaveBeenCalledWith("/finder/ffmpeg");
    expect(cmd.setFfprobePath).toHaveBeenCalledWith("/finder/ffprobe");
  });

  it("copies original when no processing was requested and native ffmpeg is unavailable", async () => {
    mockInstallerPaths = null;
    mockFindFfmpegBinaryPaths.mockResolvedValue(null);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3");

    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });

  it("throws when native ffmpeg is unavailable for preview processing", async () => {
    mockInstallerPaths = null;
    mockFindFfmpegBinaryPaths.mockResolvedValue(null);

    await expect(
      processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", {
        startTime: 10,
        fadeIn: 2,
        fadeOut: 3,
        maxDuration: 30,
      })
    ).rejects.toThrow("Native audio processing failed: Native FFmpeg not found for requested audio processing");
  });

  it("copies original when ffmpeg processing emits error and no processing was requested", async () => {
    const cmd = createFfmpegCommand("error");
    mockFfmpegFactory.mockReturnValue(cmd);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3");

    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });

  it("throws contextual error when ffmpeg processing fails for preview generation", async () => {
    mockInstallerPaths = null;
    mockFindFfmpegBinaryPaths.mockResolvedValue({
      ffmpegPath: "/finder/ffmpeg",
      ffprobePath: "/finder/ffprobe",
      source: "config",
    });
    const cmd = createFfmpegCommand("error");
    mockFfmpegFactory.mockReturnValue(cmd);

    await expect(
      processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", {
        startTime: 10,
        fadeIn: 2,
        fadeOut: 3,
        maxDuration: 30,
      })
    ).rejects.toThrow(
      "Native audio processing failed: Native FFmpeg processing failed via config: ffmpeg failed"
    );
  });
});
