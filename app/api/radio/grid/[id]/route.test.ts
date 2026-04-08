import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";

const mockGetAuthUser = vi.fn();
const mockIsAdminUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockUpdateGridEvent = vi.fn();
const mockDeleteGridEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
}));

vi.mock("@/lib/radio/streamingCenterGridClient", () => ({
  updateGridEvent: (...args: unknown[]) => mockUpdateGridEvent(...args),
  deleteGridEvent: (...args: unknown[]) => mockDeleteGridEvent(...args),
}));

describe("/api/radio/grid/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STREAMING_CENTER_API_URL = "https://sc.example.com/api/v2";
    process.env.STREAMING_CENTER_API_KEY = "secret";
    mockCreateSupabaseServerClient.mockReturnValue({});
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockIsAdminUser.mockResolvedValue(true);
  });

  it("updates an item", async () => {
    mockUpdateGridEvent.mockResolvedValue({ id: 5, name: "Updated" });

    const res = await PUT(
      new Request("http://localhost/api/radio/grid/5", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server: 1,
          name: "Updated",
          periodicity: "onetime",
          cast_type: "playlist",
          start_date: "2026-04-08",
          start_time: "08:00:00",
        }),
      }),
      { params: { id: "5" } }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 5, name: "Updated" });
  });

  it("deletes an item", async () => {
    mockDeleteGridEvent.mockResolvedValue(undefined);

    const res = await DELETE(new Request("http://localhost/api/radio/grid/5"), {
      params: { id: "5" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
