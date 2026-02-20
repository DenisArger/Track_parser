import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockUploadTrackAction = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/actions/trackActions", () => ({
  uploadTrackAction: (...args: unknown[]) => mockUploadTrackAction(...args),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/upload-ftp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/upload-ftp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({}) as never);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockUploadTrackAction).not.toHaveBeenCalled();
  });

  it("returns 400 when trackId is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });

    const res = await POST(
      jsonRequest({ ftpConfig: { host: "ftp.example.com", user: "radio" } }) as never
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Track ID is required" });
    expect(mockUploadTrackAction).not.toHaveBeenCalled();
  });

  it("returns 400 when ftpConfig is invalid", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });

    const res = await POST(jsonRequest({ trackId: "t1", ftpConfig: {} }) as never);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "FTP configuration is required (host, user)",
    });
    expect(mockUploadTrackAction).not.toHaveBeenCalled();
  });

  it("returns 200 and uploads track on success", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockUploadTrackAction.mockResolvedValue(undefined);
    const ftpConfig = { host: "ftp.example.com", user: "radio", password: "x" };

    const res = await POST(jsonRequest({ trackId: "track-1", ftpConfig }) as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: "Track uploaded successfully",
    });
    expect(mockUploadTrackAction).toHaveBeenCalledWith("track-1", ftpConfig);
  });

  it("returns 500 when upload action throws non-error value", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockUploadTrackAction.mockRejectedValue("Upload failed hard");

    const res = await POST(
      jsonRequest({
        trackId: "track-1",
        ftpConfig: { host: "ftp.example.com", user: "radio" },
      }) as never
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Upload failed hard" });
  });
});
