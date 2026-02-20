import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAllTracks,
  deleteTrack,
  generateTrackId,
  getAllTracks,
  getTrack,
  setTrack,
} from "./trackStorage";

const mockCreateSupabaseServerClient = vi.fn();
const mockDeleteFileFromStorage = vi.fn();
const mockGetBucketForOriginalPath = vi.fn();
const mockIsStoragePath = vi.fn();
const mockClearBucket = vi.fn();

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockDeleteEq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("./supabaseStorage", () => ({
  deleteFileFromStorage: (...args: unknown[]) => mockDeleteFileFromStorage(...args),
  getBucketForOriginalPath: (...args: unknown[]) =>
    mockGetBucketForOriginalPath(...args),
  isStoragePath: (...args: unknown[]) => mockIsStoragePath(...args),
  STORAGE_BUCKETS: {
    downloads: "downloads",
    processed: "processed",
    rejected: "rejected",
    previews: "previews",
  },
  clearBucket: (...args: unknown[]) => mockClearBucket(...args),
}));

function sampleTrackRow(id = "t1") {
  return {
    id,
    filename: `${id}.mp3`,
    original_path: `downloads/${id}.mp3`,
    processed_path: `processed/${id}.mp3`,
    status: "downloaded",
    metadata: {
      title: "Song",
      artist: "Artist",
      album: "",
      genre: "Средний",
      rating: 7,
      year: 2020,
    },
    download_progress: null,
    processing_progress: null,
    upload_progress: null,
    error: null,
  };
}

describe("trackStorage", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env = { ...envBackup };
    process.env.NODE_ENV = "test";
    delete process.env.NEXT_PHASE;
    delete process.env.NETLIFY_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NETLIFY;

    mockFrom.mockReturnValue({
      select: (...args: unknown[]) => mockSelect(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      insert: (...args: unknown[]) => mockInsert(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    });
    mockSelect.mockReturnValue({
      order: (...args: unknown[]) => mockOrder(...args),
      eq: (...args: unknown[]) => {
        mockSelectEq(...args);
        return { single: (...singleArgs: unknown[]) => mockSingle(...singleArgs) };
      },
    });
    mockUpdate.mockReturnValue({
      eq: (...args: unknown[]) => mockUpdateEq(...args),
    });
    mockDelete.mockReturnValue({
      eq: (...args: unknown[]) => mockDeleteEq(...args),
    });
    mockCreateSupabaseServerClient.mockReturnValue({
      from: (...args: unknown[]) => mockFrom(...args),
    });

    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
    mockGetBucketForOriginalPath.mockReturnValue("downloads");
    mockIsStoragePath.mockReturnValue(true);
    mockClearBucket.mockResolvedValue(0);
    mockDeleteFileFromStorage.mockResolvedValue(undefined);
  });

  it("generateTrackId uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-123" });

    expect(generateTrackId()).toBe("uuid-123");
  });

  it("getAllTracks returns [] in production build phase", async () => {
    process.env.NEXT_PHASE = "phase-production-build";

    const tracks = await getAllTracks();

    expect(tracks).toEqual([]);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("getAllTracks maps DB rows to Track", async () => {
    mockOrder.mockResolvedValue({ data: [sampleTrackRow("t42")], error: null });

    const tracks = await getAllTracks();

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      id: "t42",
      filename: "t42.mp3",
      originalPath: "downloads/t42.mp3",
      processedPath: "processed/t42.mp3",
      metadata: { title: "Song", artist: "Artist", rating: 7, year: 2020 },
      status: "downloaded",
    });
  });

  it("getTrack returns undefined on query error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "db fail" } });

    const track = await getTrack("t1");

    expect(track).toBeUndefined();
  });

  it("setTrack updates existing track", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "t1" }, error: null });

    await setTrack("t1", {
      id: "t1",
      filename: "t1.mp3",
      originalPath: "downloads/t1.mp3",
      metadata: {
        title: "A",
        artist: "B",
        album: "",
        genre: "Средний",
        rating: 0,
        year: 0,
      },
      status: "downloaded",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "t1");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("setTrack inserts new track when missing", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    await setTrack("t2", {
      id: "t2",
      filename: "t2.mp3",
      originalPath: "downloads/t2.mp3",
      metadata: {
        title: "A",
        artist: "B",
        album: "",
        genre: "Средний",
        rating: 0,
        year: 0,
      },
      status: "downloaded",
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("deleteTrack removes files from storage and deletes DB row", async () => {
    mockSingle.mockResolvedValueOnce({ data: sampleTrackRow("t3"), error: null });

    await deleteTrack("t3");

    expect(mockDeleteFileFromStorage).toHaveBeenCalledWith("downloads", "downloads/t3.mp3");
    expect(mockDeleteFileFromStorage).toHaveBeenCalledWith("processed", "processed/t3.mp3");
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "t3");
  });

  it("deleteTrack ignores storage deletion errors", async () => {
    mockSingle.mockResolvedValueOnce({ data: sampleTrackRow("t4"), error: null });
    mockDeleteFileFromStorage.mockRejectedValueOnce(new Error("missing file"));
    mockDeleteFileFromStorage.mockRejectedValueOnce(new Error("missing processed"));

    await deleteTrack("t4");

    expect(console.warn).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "t4");
  });

  it("deleteAllTracks deletes all tracks and clears buckets", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [sampleTrackRow("a1"), sampleTrackRow("a2")],
      error: null,
    });
    mockSingle
      .mockResolvedValueOnce({ data: sampleTrackRow("a1"), error: null })
      .mockResolvedValueOnce({ data: sampleTrackRow("a2"), error: null });
    mockClearBucket
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error("bucket error"))
      .mockResolvedValueOnce(1);

    const result = await deleteAllTracks();

    expect(result.deleted).toBe(2);
    expect(result.cleared).toEqual({
      downloads: 2,
      processed: 2,
      rejected: 0,
      previews: 1,
    });
    expect(mockDeleteEq).toHaveBeenCalledTimes(2);
  });
});
