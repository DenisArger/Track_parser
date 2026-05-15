import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockGetRadioTrackNamesSet = vi.fn();
const mockCheckTracksOnRadio = vi.fn();
const mockGetStoredTrack = vi.fn();
const mockSetTrack = vi.fn();
const mockDeleteTrackStorageFiles = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/radio/radioTracks", () => ({
  getRadioTrackNamesSet: (...args: unknown[]) =>
    mockGetRadioTrackNamesSet(...args),
}));

vi.mock("@/lib/radio/streamingCenterClient", () => ({
  checkTracksOnRadio: (...args: unknown[]) => mockCheckTracksOnRadio(...args),
  debugTrackMatchKeys: (track: { metadata?: { title?: string; artist?: string } }) => {
    const artist = track.metadata?.artist || "";
    const title = track.metadata?.title || "";
    const keys: string[] = [];
    if (artist && title) {
      keys.push(`${artist} - ${title}`.toLowerCase().trim());
      keys.push(`${title} - ${artist}`.toLowerCase().trim());
    }
    if (title) keys.push(title.toLowerCase().trim());
    if (artist) keys.push(artist.toLowerCase().trim());
    return keys;
  },
}));

vi.mock("@/lib/storage/trackStorage", () => ({
  getTrack: (...args: unknown[]) => mockGetStoredTrack(...args),
  setTrack: (...args: unknown[]) => mockSetTrack(...args),
  deleteTrackStorageFiles: (...args: unknown[]) => mockDeleteTrackStorageFiles(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockSetTrack.mockResolvedValue(undefined);
  mockDeleteTrackStorageFiles.mockResolvedValue(undefined);
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

  it("deletes storage files after persisting uploaded_radio status", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u-1" });
    mockGetRadioTrackNamesSet.mockResolvedValue(new Set(["abba - dancing queen"]));
    mockCheckTracksOnRadio.mockReturnValue({ trk1: true });
    mockGetStoredTrack.mockResolvedValue({
      id: "trk1",
      status: "uploaded_ftp",
      originalPath: "downloads/trk1.mp3",
      processedPath: "processed/trk1.mp3",
      metadata: { title: "Dancing Queen", artist: "ABBA" },
    });

    const req = new NextRequest("http://localhost/api/radio/check-batch", {
      method: "POST",
      body: JSON.stringify({
        tracks: [{ id: "trk1", metadata: { artist: "ABBA", title: "Dancing Queen" } }],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSetTrack).toHaveBeenCalledWith(
      "trk1",
      expect.objectContaining({ status: "uploaded_radio" })
    );
    expect(mockDeleteTrackStorageFiles).toHaveBeenCalledWith("trk1");
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
