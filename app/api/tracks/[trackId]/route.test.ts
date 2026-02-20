import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mockDeleteTrackAction = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  deleteTrackAction: (...args: unknown[]) => mockDeleteTrackAction(...args),
}));

describe("DELETE /api/tracks/[trackId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 400 when trackId is missing", async () => {
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({}),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Track ID is required" });
  });

  it("returns 400 for invalid literal ids", async () => {
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ trackId: "undefined" }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Track ID is required" });
  });

  it("uses first value when trackId is an array", async () => {
    mockDeleteTrackAction.mockResolvedValue(undefined);

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ trackId: ["track%201", "ignored"] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDeleteTrackAction).toHaveBeenCalledWith("track 1");
  });

  it("returns 500 when delete action fails", async () => {
    mockDeleteTrackAction.mockRejectedValue(new Error("cannot delete"));

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ trackId: "track-1" }),
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Delete failed: cannot delete" });
  });
});
