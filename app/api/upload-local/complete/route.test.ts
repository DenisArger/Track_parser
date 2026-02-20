import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockGetTrack = vi.fn();
const mockSetTrack = vi.fn();
const mockFileExistsInStorage = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/storage/trackStorage", () => ({
  getTrack: (...args: unknown[]) => mockGetTrack(...args),
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  fileExistsInStorage: (...args: unknown[]) => mockFileExistsInStorage(...args),
  STORAGE_BUCKETS: { downloads: "downloads" },
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/upload-local/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/upload-local/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({ trackId: "t1" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when trackId is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });

    const res = await POST(jsonRequest({ trackId: "   " }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "trackId is required" });
  });

  it("returns 404 when track does not exist", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockGetTrack.mockResolvedValue(null);

    const res = await POST(jsonRequest({ trackId: "t1" }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Track not found" });
  });

  it("returns 400 when originalPath is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockGetTrack.mockResolvedValue({ id: "t1", status: "downloading" });

    const res = await POST(jsonRequest({ trackId: "t1" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Track has no original path" });
  });

  it("returns 400 when uploaded file is not in storage", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockGetTrack.mockResolvedValue({
      id: "t1",
      originalPath: "t1/a.mp3",
      status: "downloading",
    });
    mockFileExistsInStorage.mockResolvedValue(false);

    const res = await POST(jsonRequest({ trackId: "t1" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Uploaded file not found in Storage" });
  });

  it("marks track as downloaded and returns ok", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    const track = {
      id: "t1",
      originalPath: "t1/a.mp3",
      status: "downloading",
    };
    mockGetTrack.mockResolvedValue(track);
    mockFileExistsInStorage.mockResolvedValue(true);

    const res = await POST(jsonRequest({ trackId: "t1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, trackId: "t1" });
    expect(mockFileExistsInStorage).toHaveBeenCalledWith("downloads", "t1/a.mp3");
    expect(mockSetTrack).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ status: "downloaded" })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockGetTrack.mockRejectedValue(new Error("db failed"));

    const res = await POST(jsonRequest({ trackId: "t1" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Complete local upload failed: db failed",
    });
  });
});
