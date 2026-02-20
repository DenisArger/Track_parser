import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/playlist/rotation-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("playlist rotation-template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ eq: (...args: unknown[]) => mockEq(...args) });
    mockEq.mockReturnValue({ maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args) });
    mockFrom.mockImplementation(() => ({
      select: (...args: unknown[]) => mockSelect(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }));
    mockCreateSupabaseServerClient.mockReturnValue({
      from: (...args: unknown[]) => mockFrom(...args),
    });
  });

  it("GET returns 401 for unauthorized user", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/playlist/rotation-template"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("GET returns default template when DB has no record", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await GET(new Request("http://localhost/api/playlist/rotation-template"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "default",
      template: [],
      settings: null,
    });
  });

  it("GET returns selected template by query name", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockMaybeSingle.mockResolvedValue({
      data: { template: ["A", "B"], settings: { min: 1 } },
      error: null,
    });

    const res = await GET(
      new Request("http://localhost/api/playlist/rotation-template?name=night")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "night",
      template: ["A", "B"],
      settings: { min: 1 },
    });
  });

  it("GET returns 403 for non-admin user", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });

    const res = await GET(new Request("http://localhost/api/playlist/rotation-template"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("GET returns 502 when DB read fails", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "select failed" } });

    const res = await GET(new Request("http://localhost/api/playlist/rotation-template"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "select failed" });
  });

  it("GET falls back to default template name on malformed URL", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const badReq = { url: "not-a-valid-url" } as Request;
    const res = await GET(badReq);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "default",
      template: [],
      settings: null,
    });
  });

  it("POST returns 401 for unauthorized user", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("POST returns 403 for non-admin user", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });

    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("POST upserts template and returns ok", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockUpsert.mockResolvedValue({ error: null });

    const res = await POST(
      jsonRequest({
        name: "night",
        template: ["fast", "slow"],
        settings: { ratio: 2 },
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith(
      { name: "night", template: ["fast", "slow"], settings: { ratio: 2 } },
      { onConflict: "name" }
    );
  });

  it("POST returns 502 on upsert error", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });

    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upsert failed" });
  });

  it("POST returns 502 when request body cannot be parsed", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    const req = new Request("http://localhost/api/playlist/rotation-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
