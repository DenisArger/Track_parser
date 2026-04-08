import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockIsAdminUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockFetchGridEvents = vi.fn();
const mockCreateGridEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
}));

vi.mock("@/lib/radio/streamingCenterGridClient", () => ({
  fetchGridEvents: (...args: unknown[]) => mockFetchGridEvents(...args),
  createGridEvent: (...args: unknown[]) => mockCreateGridEvent(...args),
}));

function jsonRequest(url: string, body?: unknown): Request {
  return new Request(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/radio/grid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STREAMING_CENTER_API_URL = "https://sc.example.com/api/v2";
    process.env.STREAMING_CENTER_API_KEY = "secret";
    mockCreateSupabaseServerClient.mockReturnValue({});
  });

  it("returns 401 when user is missing", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(
      jsonRequest("http://localhost/api/radio/grid?server=1&start_ts=1&end_ts=2")
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockIsAdminUser.mockResolvedValue(false);

    const res = await GET(
      jsonRequest("http://localhost/api/radio/grid?server=1&start_ts=1&end_ts=2")
    );

    expect(res.status).toBe(403);
  });

  it("returns grid events for admin GET", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockIsAdminUser.mockResolvedValue(true);
    mockFetchGridEvents.mockResolvedValue([{ id: 1, name: "Morning" }]);

    const res = await GET(
      jsonRequest("http://localhost/api/radio/grid?server=1&start_ts=10&end_ts=20")
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ id: 1, name: "Morning" }] });
    expect(mockFetchGridEvents).toHaveBeenCalledWith("https://sc.example.com/api/v2", "secret", {
      server: 1,
      startTs: 10,
      endTs: 20,
      utc: 1,
    }, "");
  });

  it("creates grid events for admin POST", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockIsAdminUser.mockResolvedValue(true);
    mockCreateGridEvent.mockResolvedValue({ id: 9, name: "Created" });

    const res = await POST(
      jsonRequest("http://localhost/api/radio/grid", {
        server: 1,
        name: "Created",
        periodicity: "onetime",
        cast_type: "playlist",
        start_date: "2026-04-08",
        start_time: "08:00:00",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 9, name: "Created" });
  });
});
