import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockDelete = vi.fn();
const mockNeq = vi.fn();
const mockInsert = vi.fn();
const mockUserSelect = vi.fn();
const mockUserEq = vi.fn();
const mockUserMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/playlist/related-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("playlist related-groups route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ order: (...args: unknown[]) => mockOrder(...args) });
    mockDelete.mockReturnValue({ neq: (...args: unknown[]) => mockNeq(...args) });
    mockFrom.mockImplementation((_table: string) => ({
      select: (...args: unknown[]) => mockSelect(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      insert: (...args: unknown[]) => mockInsert(...args),
    }));
    mockCreateSupabaseServerClient.mockReturnValue({
      from: (table: string) =>
        table === "users"
          ? {
              select: (...args: unknown[]) => mockUserSelect(...args),
            }
          : mockFrom(table),
    });
    mockUserSelect.mockReturnValue({ eq: (...args: unknown[]) => mockUserEq(...args) });
    mockUserEq.mockReturnValue({
      maybeSingle: (...args: unknown[]) => mockUserMaybeSingle(...args),
    });
  });

  it("GET returns 401 for unauthorized user", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    mockUserMaybeSingle.mockResolvedValue({ data: { role: "user" }, error: null });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("GET returns 403 for non-admin user", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });
    mockUserMaybeSingle.mockResolvedValue({ data: { role: "user" }, error: null });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("GET returns groups for admin", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
    });
    mockUserMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
    mockOrder.mockResolvedValue({
      data: [{ id: "g1", name: "Gold", members: ["A", "B"] }],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      groups: [{ id: "g1", name: "Gold", members: ["A", "B"] }],
    });
  });

  it("POST cleans groups, replaces data and returns count", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
    });
    mockUserMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
    mockNeq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });

    const res = await POST(
      jsonRequest({
        groups: [
          { id: "g1", name: "  Group 1 ", members: [" A ", "", "B"] },
          { name: "   ", members: [""] },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 1 });
    expect(mockInsert).toHaveBeenCalledWith([
      { id: "g1", name: "Group 1", members: ["A", "B"] },
    ]);
  });

  it("POST returns 502 when delete fails", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
    });
    mockUserMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
    mockNeq.mockResolvedValue({ error: { message: "delete failed" } });

    const res = await POST(jsonRequest({ groups: [] }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "delete failed" });
  });

  it("GET returns 502 when select fails", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
    });
    mockUserMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
    mockOrder.mockResolvedValue({ data: null, error: { message: "select failed" } });

    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "select failed" });
  });

  it("POST returns 401 for unauthorized user", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({ groups: [] }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("POST returns 403 for non-admin user", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });

    const res = await POST(jsonRequest({ groups: [] }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("POST returns 502 when insert fails", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
    });
    mockNeq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: { message: "insert failed" } });

    const res = await POST(
      jsonRequest({ groups: [{ id: "g1", name: "G1", members: ["A"] }] })
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "insert failed" });
  });

  it("POST skips insert when sanitized groups are empty", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
    });
    mockNeq.mockResolvedValue({ error: null });

    const res = await POST(jsonRequest({ groups: [{ name: " ", members: [""] }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 0 });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
