import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectBpmWasm } from "./bpmDetectorWasm";

const mockReadFile = vi.fn();
const mockMusicTempoCtor = vi.fn();

const mockLoad = vi.fn();
const mockWriteFile = vi.fn();
const mockExec = vi.fn();
const mockReadVirtualFile = vi.fn();
const mockDeleteFile = vi.fn();

let ffmpegLoaded = false;

vi.mock("fs-extra", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = ffmpegLoaded;
    load(...args: unknown[]) {
      return mockLoad(...args);
    }
    writeFile(...args: unknown[]) {
      return mockWriteFile(...args);
    }
    exec(...args: unknown[]) {
      return mockExec(...args);
    }
    readFile(...args: unknown[]) {
      return mockReadVirtualFile(...args);
    }
    deleteFile(...args: unknown[]) {
      return mockDeleteFile(...args);
    }
  },
}));

vi.mock("music-tempo", () => ({
  default: function (...args: unknown[]) {
    return mockMusicTempoCtor(...args);
  },
}));

describe("bpmDetectorWasm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const input = Buffer.from([1, 2, 3]);
    mockReadFile.mockResolvedValue(input);

    const wav = Buffer.alloc(44 + 4);
    wav.writeInt16LE(16384, 44);
    wav.writeInt16LE(-16384, 46);
    mockReadVirtualFile.mockResolvedValue(new Uint8Array(wav));

    mockLoad.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockExec.mockResolvedValue(undefined);
    mockDeleteFile.mockResolvedValue(undefined);
    mockMusicTempoCtor.mockReturnValue({ tempo: 123 });
    ffmpegLoaded = false;
  });

  it("loads ffmpeg wasm, detects bpm and cleans temp files", async () => {
    const bpm = await detectBpmWasm("/tmp/in.mp3");

    expect(bpm).toBe(123);
    expect(mockLoad).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith("input.mp3", expect.any(Uint8Array));
    expect(mockExec).toHaveBeenCalledWith([
      "-i",
      "input.mp3",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-f",
      "wav",
      "output.wav",
    ]);
    expect(mockDeleteFile).toHaveBeenCalledWith("input.mp3");
    expect(mockDeleteFile).toHaveBeenCalledWith("output.wav");
  });

  it("skips load when ffmpeg is already loaded", async () => {
    ffmpegLoaded = true;

    const bpm = await detectBpmWasm("/tmp/in.mp3");

    expect(bpm).toBe(123);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("returns null when ffmpeg pipeline throws", async () => {
    mockExec.mockRejectedValue(new Error("exec fail"));

    const bpm = await detectBpmWasm("/tmp/in.mp3");

    expect(bpm).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});
