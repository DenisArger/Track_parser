import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockLoadConfig = vi.fn();
const mockSetTrack = vi.fn();
const mockGenerateTrackId = vi.fn();
const mockSanitizeFilenameForStorage = vi.fn();
const mockCreateSignedUploadUrl = vi.fn();
const mockFrom = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("@/lib/config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock("@/lib/storage/trackStorage", () => ({
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
  generateTrackId: (...args: unknown[]) => mockGenerateTrackId(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  sanitizeFilenameForStorage: (...args: unknown[]) =>
    mockSanitizeFilenameForStorage(...args),
  STORAGE_BUCKETS: { downloads: "downloads" },
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/upload-local/signed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/upload-local/signed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockLoadConfig.mockResolvedValue({
      processing: { defaultRating: 4, defaultYear: 2026 },
    });
    mockGenerateTrackId.mockReturnValue("track-1");
    mockSanitizeFilenameForStorage.mockReturnValue("Artist - Song.mp3");
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://upload.example.com/signed", token: "token-1" },
      error: null,
    });
    mockFrom.mockReturnValue({ createSignedUploadUrl: mockCreateSignedUploadUrl });
    mockCreateSupabaseServerClient.mockReturnValue({
      storage: { from: mockFrom },
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({ filename: "a.mp3" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when filename is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });

    const res = await POST(jsonRequest({ filename: "   " }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Filename is required" });
  });

  it("returns 500 when signed url creation fails", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: "storage error" },
    });

    const res = await POST(jsonRequest({ filename: "x.mp3" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "storage error" });
  });

  it("returns signed upload payload and saves track on success", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });

    const res = await POST(
      jsonRequest({ filename: "Artist - Song.mp3", contentType: "audio/mp3" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      trackId: "track-1",
      storagePath: "track-1/Artist - Song.mp3",
      contentType: "audio/mp3",
      signedUrl: "https://upload.example.com/signed",
      token: "token-1",
    });

    expect(mockFrom).toHaveBeenCalledWith("downloads");
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith("track-1/Artist - Song.mp3");
    expect(mockSetTrack).toHaveBeenCalledWith(
      "track-1",
      expect.objectContaining({
        id: "track-1",
        filename: "Artist - Song.mp3",
        originalPath: "track-1/Artist - Song.mp3",
        status: "downloading",
        metadata: expect.objectContaining({
          title: "Artist - Song",
          rating: 4,
          year: 2026,
        }),
      })
    );
  });

  it("returns 500 on unexpected exception", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockLoadConfig.mockRejectedValue(new Error("config failed"));

    const res = await POST(jsonRequest({ filename: "x.mp3" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Signed local upload failed: config failed",
    });
  });
});
