import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockCreateSupabaseServerClient = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();

  mockFrom.mockReturnValue({
    select: (...args: unknown[]) => mockSelect(...args),
  });
  mockCreateSupabaseServerClient.mockReturnValue({
    from: (...args: unknown[]) => mockFrom(...args),
  });
});

describe("GET /api/radio/count", () => {
  it("returns count from supabase", async () => {
    mockSelect.mockResolvedValue({ count: 12, error: null });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 12 });
    expect(mockFrom).toHaveBeenCalledWith("radio_tracks");
    expect(mockSelect).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
  });

  it("returns 0 when count is null", async () => {
    mockSelect.mockResolvedValue({ count: null, error: null });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0 });
  });

  it("returns 502 when supabase returns an error", async () => {
    mockSelect.mockResolvedValue({
      count: null,
      error: { message: "supabase failed" },
    });

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "supabase failed" });
  });

  it("returns 502 when an exception is thrown", async () => {
    mockCreateSupabaseServerClient.mockImplementation(() => {
      throw new Error("boom");
    });

    const res = await GET();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});
