import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockChangeTrackStatusAction = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/actions/trackActions", () => ({
  changeTrackStatusAction: (...args: unknown[]) =>
    mockChangeTrackStatusAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/tracks/[trackId]/status", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/tracks/trk-1/status", {
      method: "POST",
      body: JSON.stringify({ status: "downloaded" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ trackId: "trk-1" }),
    });

    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.error).toBe("Unauthorized");
    expect(mockChangeTrackStatusAction).not.toHaveBeenCalled();
  });

  it("returns 400 when trackId is missing", async () => {
    mockGetAuthUser.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/tracks//status", {
      method: "POST",
      body: JSON.stringify({ status: "downloaded" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ trackId: "" }),
    });

    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe("Track ID is required");
    expect(mockChangeTrackStatusAction).not.toHaveBeenCalled();
  });

  it("returns 400 when status is missing", async () => {
    mockGetAuthUser.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/tracks/trk-1/status", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, {
      params: Promise.resolve({ trackId: "trk-1" }),
    });

    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe("Status is required");
    expect(mockChangeTrackStatusAction).not.toHaveBeenCalled();
  });

  it("returns 400 when status is invalid", async () => {
    mockGetAuthUser.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/tracks/trk-1/status", {
      method: "POST",
      body: JSON.stringify({ status: "invalid" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ trackId: "trk-1" }),
    });

    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toContain("Invalid status");
    expect(j.error).toContain("downloading");
    expect(mockChangeTrackStatusAction).not.toHaveBeenCalled();
  });

  it("returns 200 with track when successful", async () => {
    mockGetAuthUser.mockResolvedValue({});
    const track = { id: "trk-1", status: "downloaded" as const };
    mockChangeTrackStatusAction.mockResolvedValue(track);

    const req = new NextRequest("http://localhost/api/tracks/trk-1/status", {
      method: "POST",
      body: JSON.stringify({ status: "downloaded" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ trackId: "trk-1" }),
    });

    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.track).toEqual(track);
    expect(mockChangeTrackStatusAction).toHaveBeenCalledWith(
      "trk-1",
      "downloaded"
    );
  });

  it("returns 500 when changeTrackStatusAction throws", async () => {
    mockGetAuthUser.mockResolvedValue({});
    mockChangeTrackStatusAction.mockRejectedValue(new Error("DB error"));

    const req = new NextRequest("http://localhost/api/tracks/trk-1/status", {
      method: "POST",
      body: JSON.stringify({ status: "downloaded" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ trackId: "trk-1" }),
    });

    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).toBe("DB error");
  });
});
