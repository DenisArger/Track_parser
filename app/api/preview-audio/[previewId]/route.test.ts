import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockGetAuthUser = vi.fn();
const mockDownloadFileFromStorage = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  downloadFileFromStorage: (...args: unknown[]) =>
    mockDownloadFileFromStorage(...args),
  STORAGE_BUCKETS: { previews: "previews-bucket" },
}));

describe("GET /api/preview-audio/[previewId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 for unauthorized user", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ previewId: "p1" }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns mp3 buffer for valid preview", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockDownloadFileFromStorage.mockResolvedValue(Buffer.from("abc"));

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ previewId: "preview-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("content-length")).toBe("3");
    expect(mockDownloadFileFromStorage).toHaveBeenCalledWith(
      "previews-bucket",
      "preview-1.mp3"
    );
  });

  it("returns 404 when storage lookup fails", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockDownloadFileFromStorage.mockRejectedValue(new Error("not found"));

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ previewId: "missing" }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Preview file not found" });
  });
});
