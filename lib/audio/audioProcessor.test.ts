import { beforeEach, describe, expect, it, vi } from "vitest";
import { processAudioFile } from "./audioProcessor";

const mockCopy = vi.fn();
const mockIsServerlessEnvironment = vi.fn();
const mockProcessAudioFileWasm = vi.fn();
const mockFindFfmpegPath = vi.fn();
const mockFfmpegFactory = vi.fn();

vi.mock("fs-extra", () => ({
  copy: (...args: unknown[]) => mockCopy(...args),
}));

vi.mock("@/lib/utils/environment", () => ({
  isServerlessEnvironment: (...args: unknown[]) =>
    mockIsServerlessEnvironment(...args),
}));

vi.mock("./audioProcessorWasm", () => ({
  processAudioFileWasm: (...args: unknown[]) => mockProcessAudioFileWasm(...args),
}));

vi.mock("@/lib/utils/ffmpegFinder", () => ({
  findFfmpegPath: (...args: unknown[]) => mockFindFfmpegPath(...args),
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

    mockCopy.mockResolvedValue(undefined);
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockResolvedValue(undefined);
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
  });

  it("uses wasm in serverless environment and returns", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);
    mockProcessAudioFileWasm.mockResolvedValue(undefined);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3");

    expect(mockProcessAudioFileWasm).toHaveBeenCalledWith(
      "/tmp/in.mp3",
      "/tmp/out.mp3",
      undefined,
      undefined
    );
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("falls back to copy in serverless when wasm fails", async () => {
    mockIsServerlessEnvironment.mockReturnValue(true);
    mockProcessAudioFileWasm.mockRejectedValue(new Error("wasm fail"));

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3");

    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });

  it("uses wasm first in non-serverless and returns on success", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockResolvedValue(undefined);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", { startTime: 0, fadeIn: 0, fadeOut: 0 });

    expect(mockProcessAudioFileWasm).toHaveBeenCalled();
    expect(mockFindFfmpegPath).not.toHaveBeenCalled();
  });

  it("falls back to copy when native ffmpeg path is missing", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockRejectedValue(new Error("wasm fail"));
    mockFindFfmpegPath.mockResolvedValue("");

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3");

    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });

  it("processes with native ffmpeg using trim settings", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockRejectedValue(new Error("wasm fail"));
    mockFindFfmpegPath.mockResolvedValue("/usr/local/bin");

    const cmd = createFfmpegCommand("end");
    mockFfmpegFactory.mockReturnValue(cmd);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", {
      startTime: 10,
      endTime: 40,
      fadeIn: 2,
      fadeOut: 3,
    });

    expect(mockFfmpegFactory).toHaveBeenCalledWith("/tmp/in.mp3");
    expect(cmd.setStartTime).toHaveBeenCalledWith(10);
    expect(cmd.duration).toHaveBeenCalledWith(30);
    expect(cmd.audioFilters).toHaveBeenCalled();
    expect(cmd.output).toHaveBeenCalledWith("/tmp/out.mp3");
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it("copies original when ffmpeg processing emits error", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockRejectedValue(new Error("wasm fail"));
    mockFindFfmpegPath.mockResolvedValue("/usr/local/bin");

    const cmd = createFfmpegCommand("error");
    mockFfmpegFactory.mockReturnValue(cmd);

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3", undefined, 120);

    expect(cmd.setStartTime).toHaveBeenCalledWith(0);
    expect(cmd.duration).toHaveBeenCalledWith(120);
    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });

  it("copies original when native ffmpeg setup throws", async () => {
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockProcessAudioFileWasm.mockRejectedValue(new Error("wasm fail"));
    mockFindFfmpegPath.mockRejectedValue(new Error("finder fail"));

    await processAudioFile("/tmp/in.mp3", "/tmp/out.mp3");

    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });
});
