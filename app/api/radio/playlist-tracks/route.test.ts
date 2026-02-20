import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockGetAuthUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();

  mockSelect.mockReturnValue({
    order: (...args: unknown[]) => mockOrder(...args),
  });
  mockFrom.mockReturnValue({
    select: (...args: unknown[]) => mockSelect(...args),
  });
  mockCreateSupabaseServerClient.mockReturnValue({
    from: (...args: unknown[]) => mockFrom(...args),
  });
});

describe("GET /api/radio/playlist-tracks", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns tracks for admin user", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "Den.Arger@gmail.com" });
    mockOrder.mockResolvedValue({
      data: [{ id: "r1", raw_name: "test.mp3" }],
      error: null,
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tracks: [{ id: "r1", raw_name: "test.mp3" }],
    });
    expect(mockFrom).toHaveBeenCalledWith("radio_tracks");
    expect(mockSelect).toHaveBeenCalledWith(
      "id, raw_name, artist, title, track_type, year, rating, created_at"
    );
    expect(mockOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
      nullsFirst: false,
    });
  });

  it("returns 502 when query fails", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "db failed" },
    });

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "db failed" });
  });

  it("returns 502 when an exception is thrown", async () => {
    mockGetAuthUser.mockRejectedValue(new Error("unexpected"));

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "unexpected" });
  });
});
