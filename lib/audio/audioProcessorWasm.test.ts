import { beforeEach, describe, expect, it, vi } from "vitest";
import { processAudioFileWasm } from "./audioProcessorWasm";

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockCopy = vi.fn();

const mockOn = vi.fn();
const mockLoad = vi.fn();
const mockWriteVirtualFile = vi.fn();
const mockExec = vi.fn();
const mockReadVirtualFile = vi.fn();
const mockDeleteVirtualFile = vi.fn();

let ffmpegLoaded = false;

vi.mock("fs-extra", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = ffmpegLoaded;
    on(...args: unknown[]) {
      return mockOn(...args);
    }
    load(...args: unknown[]) {
      return mockLoad(...args);
    }
    writeFile(...args: unknown[]) {
      return mockWriteVirtualFile(...args);
    }
    exec(...args: unknown[]) {
      return mockExec(...args);
    }
    readFile(...args: unknown[]) {
      return mockReadVirtualFile(...args);
    }
    deleteFile(...args: unknown[]) {
      return mockDeleteVirtualFile(...args);
    }
  },
}));

describe("audioProcessorWasm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    ffmpegLoaded = false;
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockWriteFile.mockResolvedValue(undefined);
    mockCopy.mockResolvedValue(undefined);
    mockLoad.mockResolvedValue(undefined);
    mockWriteVirtualFile.mockResolvedValue(undefined);
    mockExec.mockResolvedValue(undefined);
    mockReadVirtualFile.mockResolvedValue(new Uint8Array([10, 20]));
    mockDeleteVirtualFile.mockResolvedValue(undefined);
  });

  it("processes audio with trim settings and writes output", async () => {
    await processAudioFileWasm("/tmp/in.mp3", "/tmp/out.mp3", {
      startTime: 5,
      endTime: 25,
      fadeIn: 2,
      fadeOut: 3,
    });

    expect(mockLoad).toHaveBeenCalled();
    expect(mockWriteVirtualFile).toHaveBeenCalledWith(
      "input.mp3",
      expect.any(Uint8Array)
    );

    const args = mockExec.mock.calls[0][0] as string[];
    expect(args).toContain("-ss");
    expect(args).toContain("5");
    expect(args).toContain("-t");
    expect(args).toContain("20");
    expect(args).toContain("-af");
    expect(args.join(" ")).toContain("afade=t=in");
    expect(args.join(" ")).toContain("afade=t=out");
    expect(args.slice(-3)).toEqual(["-ab", "192k", "output.mp3"]);

    expect(mockWriteFile).toHaveBeenCalledWith(
      "/tmp/out.mp3",
      expect.any(Buffer)
    );
    expect(mockDeleteVirtualFile).toHaveBeenCalledWith("input.mp3");
    expect(mockDeleteVirtualFile).toHaveBeenCalledWith("output.mp3");
  });

  it("uses maxDuration when trim settings are not provided and skips load if already loaded", async () => {
    ffmpegLoaded = true;

    await processAudioFileWasm("/tmp/in.mp3", "/tmp/out.mp3", undefined, 120);

    expect(mockLoad).not.toHaveBeenCalled();
    const args = mockExec.mock.calls[0][0] as string[];
    expect(args).toContain("-t");
    expect(args).toContain("120");
  });

  it("falls back to copy and throws wrapped error on failure", async () => {
    mockExec.mockRejectedValue(new Error("wasm failed"));

    await expect(
      processAudioFileWasm("/tmp/in.mp3", "/tmp/out.mp3")
    ).rejects.toThrow("FFmpeg.wasm processing failed: wasm failed");

    expect(mockCopy).toHaveBeenCalledWith("/tmp/in.mp3", "/tmp/out.mp3");
  });
});
