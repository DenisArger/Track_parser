import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockGetRadioTrackNamesSet = vi.fn();
const mockCheckTracksOnRadio = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/radio/radioTracks", () => ({
  getRadioTrackNamesSet: (...args: unknown[]) =>
    mockGetRadioTrackNamesSet(...args),
}));

vi.mock("@/lib/radio/streamingCenterClient", () => ({
  checkTracksOnRadio: (...args: unknown[]) => mockCheckTracksOnRadio(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/radio/check-batch", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/radio/check-batch", {
      method: "POST",
      body: JSON.stringify({ tracks: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockGetRadioTrackNamesSet).not.toHaveBeenCalled();
  });

  it("returns 400 when tracks is not an array", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u-1" });

    const req = new NextRequest("http://localhost/api/radio/check-batch", {
      method: "POST",
      body: JSON.stringify({ tracks: "invalid" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "tracks array is required" });
    expect(mockGetRadioTrackNamesSet).not.toHaveBeenCalled();
  });

  it("returns onRadio map for valid request", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u-1" });
    const radioSet = new Set(["abba - dancing queen"]);
    const onRadio = { trk1: true, trk2: false };
    mockGetRadioTrackNamesSet.mockResolvedValue(radioSet);
    mockCheckTracksOnRadio.mockReturnValue(onRadio);

    const req = new NextRequest("http://localhost/api/radio/check-batch", {
      method: "POST",
      body: JSON.stringify({
        tracks: [
          { id: "trk1", metadata: { artist: "ABBA", title: "Dancing Queen" } },
          { metadata: { artist: "Muse", title: "Starlight" } },
        ],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onRadio });
    expect(mockCheckTracksOnRadio).toHaveBeenCalledWith(
      [
        {
          id: "trk1",
          metadata: { artist: "ABBA", title: "Dancing Queen" },
        },
        {
          id: "",
          metadata: { artist: "Muse", title: "Starlight" },
        },
      ],
      radioSet
    );
  });

  it("returns 502 on internal error", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u-1" });
    mockGetRadioTrackNamesSet.mockRejectedValue(new Error("radio unavailable"));

    const req = new NextRequest("http://localhost/api/radio/check-batch", {
      method: "POST",
      body: JSON.stringify({ tracks: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "radio unavailable" });
  });
});
