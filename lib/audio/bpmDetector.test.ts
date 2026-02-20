import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectBpm } from "./bpmDetector";

const mockReadFile = vi.fn();
const mockRemove = vi.fn();
const mockMusicTempoCtor = vi.fn();
const mockFfmpeg = vi.fn();

vi.mock("fs-extra", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
}));

vi.mock("music-tempo", () => ({
  default: function (...args: unknown[]) {
    return mockMusicTempoCtor(...args);
  },
}));

vi.mock("fluent-ffmpeg", () => ({
  default: (...args: unknown[]) => mockFfmpeg(...args),
}));

describe("bpmDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const wav = Buffer.alloc(44 + 4);
    wav.writeInt16LE(16384, 44);
    wav.writeInt16LE(-16384, 46);
    mockReadFile.mockResolvedValue(wav);
    mockRemove.mockResolvedValue(undefined);
    mockMusicTempoCtor.mockReturnValue({ tempo: 128 });

    mockFfmpeg.mockImplementation(() => {
      const handlers: Record<string, (...args: unknown[]) => void> = {};
      const chain = {
        audioChannels: vi.fn().mockReturnThis(),
        audioFrequency: vi.fn().mockReturnThis(),
        format: vi.fn().mockReturnThis(),
        output: vi.fn().mockReturnThis(),
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
          return chain;
        }),
        run: vi.fn(() => {
          handlers.end?.();
        }),
      };
      return chain;
    });
  });

  it("detects bpm from converted wav and removes temp file", async () => {
    const bpm = await detectBpm("/tmp/song.mp3");

    expect(bpm).toBe(128);
    expect(mockFfmpeg).toHaveBeenCalledWith("/tmp/song.mp3");
    expect(mockReadFile).toHaveBeenCalledWith("/tmp/song.bpm.wav");
    expect(mockRemove).toHaveBeenCalledWith("/tmp/song.bpm.wav");
  });

  it("removes temp wav even when parsing fails", async () => {
    mockReadFile.mockRejectedValue(new Error("read fail"));

    await expect(detectBpm("/tmp/song.mp3")).rejects.toThrow("read fail");
    expect(mockRemove).toHaveBeenCalledWith("/tmp/song.bpm.wav");
  });
});
