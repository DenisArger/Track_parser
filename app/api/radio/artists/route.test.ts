import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockGetAuthUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockNot = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();

  mockSelect.mockReturnValue({
    not: (...args: unknown[]) => mockNot(...args),
  });
  mockFrom.mockReturnValue({
    select: (...args: unknown[]) => mockSelect(...args),
  });
  mockCreateSupabaseServerClient.mockReturnValue({
    from: (...args: unknown[]) => mockFrom(...args),
  });
});

describe("GET /api/radio/artists", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns sorted unique artists when authorized", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u-1" });
    mockNot.mockResolvedValue({
      data: [
        { artist: "  Muse " },
        { artist: "ABBA" },
        { artist: "Muse" },
        { artist: "" },
        { artist: null },
      ],
      error: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ artists: ["ABBA", "Muse"] });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(mockFrom).toHaveBeenCalledWith("radio_tracks");
    expect(mockSelect).toHaveBeenCalledWith("artist");
    expect(mockNot).toHaveBeenCalledWith("artist", "is", null);
  });

  it("returns 502 when supabase returns an error", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u-1" });
    mockNot.mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "query failed" });
  });

  it("returns 502 when an exception is thrown", async () => {
    mockGetAuthUser.mockRejectedValue(new Error("auth error"));

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "auth error" });
  });
});
