import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockGetAuthUser = vi.fn();
const mockGetTrack = vi.fn();
const mockHandleNotFoundError = vi.fn();
const mockHandleApiError = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockDownloadFileFromStorage = vi.fn();
const mockIsServerlessEnvironment = vi.fn();
const mockLoadConfig = vi.fn();
const mockDownloadTrackViaRapidAPI = vi.fn();
const mockSetTrack = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/processTracks", () => ({
  getTrack: (...args: unknown[]) => mockGetTrack(...args),
}));

vi.mock("@/lib/api/errorHandler", () => ({
  handleNotFoundError: (...args: unknown[]) => mockHandleNotFoundError(...args),
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
  downloadFileFromStorage: (...args: unknown[]) =>
    mockDownloadFileFromStorage(...args),
  STORAGE_BUCKETS: {
    downloads: "downloads-bucket",
    processed: "processed-bucket",
    rejected: "rejected-bucket",
  },
}));

vi.mock("@/lib/utils/environment", () => ({
  isServerlessEnvironment: (...args: unknown[]) =>
    mockIsServerlessEnvironment(...args),
}));

vi.mock("@/lib/config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock("@/lib/download/youtubeDownloader", () => ({
  downloadTrackViaRapidAPI: (...args: unknown[]) =>
    mockDownloadTrackViaRapidAPI(...args),
}));

vi.mock("@/lib/storage/trackStorage", () => ({
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
}));

describe("GET /api/audio/[trackId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockGetTrack.mockResolvedValue({
      id: "t1",
      filename: "Artist - Song.mp3",
      originalPath: "downloads/t1/Artist - Song.mp3",
      processedPath: "processed/t1/Artist - Song.mp3",
      status: "downloaded",
      metadata: {},
    });
    mockHandleNotFoundError.mockImplementation((message: string) =>
      Response.json({ error: message }, { status: 404 })
    );
    mockHandleApiError.mockImplementation((error: unknown, message: string) =>
      Response.json(
        { error: `${message}: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 }
      )
    );
    mockCreateSignedUrl.mockResolvedValue("https://storage.example.com/signed-url");
    mockDownloadFileFromStorage.mockResolvedValue(Buffer.from("abcdef"));
    mockIsServerlessEnvironment.mockReturnValue(false);
    mockLoadConfig.mockResolvedValue({ folders: { downloads: "/tmp/downloads" } });
    mockDownloadTrackViaRapidAPI.mockResolvedValue({ storagePath: "new/t1.mp3" });
    mockSetTrack.mockResolvedValue(undefined);
  });

  it("returns 401 for unauthorized user", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/audio/t1") as never,
      { params: Promise.resolve({ trackId: "t1" }) }
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns not found when track is missing", async () => {
    mockGetTrack.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/audio/t1") as never,
      { params: Promise.resolve({ trackId: "t1" }) }
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Track not found" });
  });

  it("redirects to signed url for processed file when forced", async () => {
    const res = await GET(
      new Request("http://localhost/api/audio/t1?processed=true") as never,
      { params: Promise.resolve({ trackId: "t1" }) }
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://storage.example.com/signed-url");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "processed-bucket",
      "t1/Artist - Song.mp3",
      3600
    );
  });

  it("serves partial content from buffer when range requested and signed url fails", async () => {
    mockCreateSignedUrl.mockRejectedValue(new Error("signed url failed"));

    const req = new Request("http://localhost/api/audio/t1", {
      headers: { range: "bytes=1-3" },
    });
    const res = await GET(req as never, {
      params: Promise.resolve({ trackId: "t1" }),
    });

    expect(res.status).toBe(206);
    expect(await res.arrayBuffer()).toEqual(new Uint8Array(Buffer.from("bcd")).buffer);
    expect(res.headers.get("content-range")).toBe("bytes 1-3/6");
    expect(res.headers.get("content-length")).toBe("3");
    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "t1/Artist - Song.mp3"
    );
  });

  it("re-downloads in serverless for youtube tracks when storage access fails", async () => {
    mockCreateSignedUrl.mockRejectedValue(new Error("signed url failed"));
    mockIsServerlessEnvironment.mockReturnValue(true);
    mockGetTrack.mockResolvedValue({
      id: "t1",
      filename: "Artist - Song.mp3",
      originalPath: "downloads/t1/Artist - Song.mp3",
      status: "downloaded",
      metadata: { sourceUrl: "https://youtube.com/watch?v=1", sourceType: "youtube" },
    });
    mockDownloadFileFromStorage.mockResolvedValue(Buffer.from("serverless-audio"));

    const res = await GET(
      new Request("http://localhost/api/audio/t1") as never,
      { params: Promise.resolve({ trackId: "t1" }) }
    );

    expect(res.status).toBe(200);
    expect(mockDownloadTrackViaRapidAPI).toHaveBeenCalledWith(
      "https://youtube.com/watch?v=1",
      "/tmp/downloads",
      "t1"
    );
    expect(mockSetTrack).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ originalPath: "new/t1.mp3" })
    );
    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith(
      "downloads-bucket",
      "new/t1.mp3"
    );
  });

  it("uses api error handler on unexpected exception", async () => {
    mockGetTrack.mockRejectedValue(new Error("boom"));

    const res = await GET(
      new Request("http://localhost/api/audio/t1") as never,
      { params: Promise.resolve({ trackId: "t1" }) }
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Failed to serve audio file: boom",
    });
    expect(mockHandleApiError).toHaveBeenCalled();
  });
});
