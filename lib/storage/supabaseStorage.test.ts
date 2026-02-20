import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_BUCKETS,
  clearBucket,
  createSignedUrl,
  deleteFileFromStorage,
  downloadFileFromStorage,
  fileExistsInStorage,
  getBucketForOriginalPath,
  getPublicUrl,
  isStoragePath,
  sanitizeFilenameForStorage,
  uploadFileToStorage,
} from "./supabaseStorage";

const mockCreateSupabaseServerClient = vi.fn();
const mockFrom = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();
const mockList = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

describe("supabaseStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockFrom.mockReturnValue({
      upload: (...args: unknown[]) => mockUpload(...args),
      getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      download: (...args: unknown[]) => mockDownload(...args),
      remove: (...args: unknown[]) => mockRemove(...args),
      list: (...args: unknown[]) => mockList(...args),
    });
    mockCreateSupabaseServerClient.mockReturnValue({
      storage: {
        from: (...args: unknown[]) => mockFrom(...args),
      },
    });

    mockUpload.mockResolvedValue({ data: { path: "p/file.mp3" }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn/file.mp3" } });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed/file.mp3" },
      error: null,
    });
    mockDownload.mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3])]),
      error: null,
    });
    mockRemove.mockResolvedValue({ error: null });
    mockList.mockResolvedValue({ data: [], error: null });
  });

  it("sanitizeFilenameForStorage normalizes unsafe names", () => {
    expect(sanitizeFilenameForStorage("Тест !@#.mp3")).toBe("audio.mp3");
    expect(sanitizeFilenameForStorage("a  b--c.wav")).toBe("a_b--c.wav");
    expect(sanitizeFilenameForStorage("")).toBe("audio.mp3");
  });

  it("helpers isStoragePath/getBucketForOriginalPath return expected values", () => {
    expect(isStoragePath("downloads/a.mp3")).toBe(true);
    expect(isStoragePath("/tmp/a.mp3")).toBe(false);
    expect(isStoragePath("C:\\music\\a.mp3")).toBe(false);

    expect(getBucketForOriginalPath("rejected")).toBe(STORAGE_BUCKETS.rejected);
    expect(getBucketForOriginalPath("downloaded")).toBe(STORAGE_BUCKETS.downloads);
  });

  it("uploadFileToStorage uploads and returns public URL", async () => {
    const result = await uploadFileToStorage(
      STORAGE_BUCKETS.downloads,
      "a/b.mp3",
      Buffer.from([1, 2]),
      { contentType: "audio/mpeg", upsert: false }
    );

    expect(mockUpload).toHaveBeenCalledWith("a/b.mp3", expect.any(Buffer), {
      contentType: "audio/mpeg",
      upsert: false,
    });
    expect(result).toEqual({
      path: "p/file.mp3",
      publicUrl: "https://cdn/file.mp3",
    });
  });

  it("uploadFileToStorage throws on upload error", async () => {
    mockUpload.mockResolvedValue({ data: null, error: new Error("upload failed") });

    await expect(
      uploadFileToStorage(STORAGE_BUCKETS.downloads, "x.mp3", Buffer.from([1]))
    ).rejects.toThrow("upload failed");
  });

  it("createSignedUrl and getPublicUrl return URLs", async () => {
    await expect(
      createSignedUrl(STORAGE_BUCKETS.processed, "x.mp3", 99)
    ).resolves.toBe("https://signed/file.mp3");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("x.mp3", 99);

    expect(getPublicUrl(STORAGE_BUCKETS.processed, "x.mp3")).toBe(
      "https://cdn/file.mp3"
    );
  });

  it("downloadFileFromStorage returns a buffer and deleteFileFromStorage removes file", async () => {
    const buffer = await downloadFileFromStorage(STORAGE_BUCKETS.downloads, "a.mp3");
    expect(buffer).toEqual(Buffer.from([1, 2, 3]));

    await deleteFileFromStorage(STORAGE_BUCKETS.downloads, "a.mp3");
    expect(mockRemove).toHaveBeenCalledWith(["a.mp3"]);
  });

  it("fileExistsInStorage checks file names and handles list errors", async () => {
    mockList.mockResolvedValueOnce({
      data: [{ name: "a.mp3" }, { name: "b.mp3" }],
      error: null,
    });
    await expect(fileExistsInStorage(STORAGE_BUCKETS.downloads, "dir/a.mp3")).resolves.toBe(
      true
    );

    mockList.mockResolvedValueOnce({
      data: [{ name: "x.mp3" }],
      error: null,
    });
    await expect(fileExistsInStorage(STORAGE_BUCKETS.downloads, "dir/a.mp3")).resolves.toBe(
      false
    );

    mockList.mockResolvedValueOnce({ data: null, error: new Error("list fail") });
    await expect(fileExistsInStorage(STORAGE_BUCKETS.downloads, "dir/a.mp3")).resolves.toBe(
      false
    );
  });

  it("clearBucket recursively lists and removes all files", async () => {
    mockList.mockImplementation((prefix: string) => {
      const map: Record<string, Array<{ name: string }>> = {
        "": [{ name: "folder" }, { name: "root.mp3" }],
        folder: [{ name: "inner.mp3" }],
        "folder/inner.mp3": [],
        "root.mp3": [],
      };
      return Promise.resolve({ data: map[prefix] ?? [], error: null });
    });

    const deleted = await clearBucket(STORAGE_BUCKETS.downloads);

    expect(deleted).toBe(2);
    expect(mockRemove).toHaveBeenCalledWith(["folder/inner.mp3", "root.mp3"]);
  });

  it("clearBucket removes in 500-size chunks", async () => {
    const names = Array.from({ length: 501 }, (_, i) => ({ name: `f${i}.mp3` }));
    mockList.mockImplementation((prefix: string) => {
      if (prefix === "") return Promise.resolve({ data: names, error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const deleted = await clearBucket(STORAGE_BUCKETS.downloads);

    expect(deleted).toBe(501);
    expect(mockRemove).toHaveBeenCalledTimes(2);
    const first = mockRemove.mock.calls[0][0] as string[];
    const second = mockRemove.mock.calls[1][0] as string[];
    expect(first).toHaveLength(500);
    expect(second).toHaveLength(1);
  });
});
