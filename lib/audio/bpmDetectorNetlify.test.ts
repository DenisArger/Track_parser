import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectBpmFromBuffer, detectBpmNetlify } from "./bpmDetectorNetlify";

const mockIsServerlessEnvironment = vi.fn();
const mockDetectBpmWasm = vi.fn();
const mockFindFfmpegPath = vi.fn();
const mockDetectBpm = vi.fn();
const mockMusicTempoCtor = vi.fn();

vi.mock("@/lib/utils/environment", () => ({
  isServerlessEnvironment: (...args: unknown[]) =>
    mockIsServerlessEnvironment(...args),
}));

vi.mock("./bpmDetectorWasm", () => ({
  detectBpmWasm: (...args: unknown[]) => mockDetectBpmWasm(...args),
}));

vi.mock("@/lib/utils/ffmpegFinder", () => ({
  findFfmpegPath: (...args: unknown[]) => mockFindFfmpegPath(...args),
}));

vi.mock("./bpmDetector", () => ({
  detectBpm: (...args: unknown[]) => mockDetectBpm(...args),
}));

vi.mock("music-tempo", () => ({
  default: function (...args: unknown[]) {
    return mockMusicTempoCtor(...args);
  },
}));

describe("bpmDetectorNetlify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockIsServerlessEnvironment.mockReturnValue(true);
  });

  it("returns BPM from wasm when available", async () => {
    mockDetectBpmWasm.mockResolvedValue(128);

    const bpm = await detectBpmNetlify("/tmp/a.mp3");

    expect(bpm).toBe(128);
    expect(mockDetectBpmWasm).toHaveBeenCalledWith("/tmp/a.mp3");
    expect(mockFindFfmpegPath).not.toHaveBeenCalled();
  });

  it("falls back to native ffmpeg when wasm returns null", async () => {
    mockDetectBpmWasm.mockResolvedValue(null);
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockDetectBpm.mockResolvedValue(100);

    const bpm = await detectBpmNetlify("/tmp/a.mp3");

    expect(bpm).toBe(100);
    expect(mockFindFfmpegPath).toHaveBeenCalled();
    expect(mockDetectBpm).toHaveBeenCalledWith("/tmp/a.mp3");
  });

  it("returns null when no native ffmpeg is found", async () => {
    mockDetectBpmWasm.mockRejectedValue(new Error("wasm fail"));
    mockFindFfmpegPath.mockResolvedValue("");

    const bpm = await detectBpmNetlify("/tmp/a.mp3");

    expect(bpm).toBeNull();
  });

  it("returns null when native bpm detection throws", async () => {
    mockDetectBpmWasm.mockResolvedValue(null);
    mockFindFfmpegPath.mockResolvedValue("/usr/bin");
    mockDetectBpm.mockRejectedValue(new Error("native fail"));

    const bpm = await detectBpmNetlify("/tmp/a.mp3");

    expect(bpm).toBeNull();
  });

  it("detectBpmFromBuffer returns tempo", async () => {
    mockMusicTempoCtor.mockReturnValue({ tempo: 124 });

    const bpm = await detectBpmFromBuffer(new Float32Array([0.1, 0.2]));

    expect(bpm).toBe(124);
    const passed = mockMusicTempoCtor.mock.calls[0][0] as number[];
    expect(passed[0]).toBeCloseTo(0.1, 5);
    expect(passed[1]).toBeCloseTo(0.2, 5);
  });

  it("detectBpmFromBuffer returns null on error", async () => {
    mockMusicTempoCtor.mockImplementation(() => {
      throw new Error("parse fail");
    });

    const bpm = await detectBpmFromBuffer(new Float32Array([0.1]));

    expect(bpm).toBeNull();
  });
});
