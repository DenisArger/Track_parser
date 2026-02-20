import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockSyncRadioTracksFromApi = vi.fn();

vi.mock("@/lib/radio/radioTracks", () => ({
  syncRadioTracksFromApi: (...args: unknown[]) =>
    mockSyncRadioTracksFromApi(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/radio/sync", () => {
  it("returns success true and count 0", async () => {
    mockSyncRadioTracksFromApi.mockResolvedValue({ count: 0 });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 0 });
    expect(console.warn).toHaveBeenCalled();
  });

  it("returns success true and non-zero count", async () => {
    mockSyncRadioTracksFromApi.mockResolvedValue({ count: 7 });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 7 });
    expect(console.log).toHaveBeenCalledWith(
      "Radio sync: saved",
      7,
      "tracks to radio_tracks"
    );
  });

  it("returns 502 when sync throws", async () => {
    mockSyncRadioTracksFromApi.mockRejectedValue(new Error("api down"));

    const res = await POST();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "api down" });
  });
});
