import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAdminUser, isAdminUserClient } from "./admin";

const mockCreateSupabaseServerClient = vi.fn();
const mockGetSupabase = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
}));

describe("admin access helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ eq: (...args: unknown[]) => mockEq(...args) });
    mockEq.mockReturnValue({ maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args) });
    mockFrom.mockReturnValue({
      select: (...args: unknown[]) => mockSelect(...args),
    });
    mockCreateSupabaseServerClient.mockReturnValue({
      from: (...args: unknown[]) => mockFrom(...args),
    });
    mockGetSupabase.mockReturnValue({
      from: (...args: unknown[]) => mockFrom(...args),
    });
  });

  it("returns true when public.users role is admin on server", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });

    await expect(isAdminUser(mockCreateSupabaseServerClient(), { id: "u1" })).resolves.toBe(true);
    expect(mockCreateSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("role");
    expect(mockEq).toHaveBeenCalledWith("id", "u1");
  });

  it("returns false when public.users role is not admin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: "user" }, error: null });

    await expect(isAdminUser(mockCreateSupabaseServerClient(), { id: "u1" })).resolves.toBe(false);
  });

  it("returns true for client helper too", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });

    await expect(isAdminUserClient("u1")).resolves.toBe(true);
  });

  it("returns false when user id is missing", async () => {
    await expect(isAdminUser(mockCreateSupabaseServerClient(), null)).resolves.toBe(false);
    await expect(isAdminUserClient(null)).resolves.toBe(false);
  });
});
