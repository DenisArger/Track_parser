import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateBrowserClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}));

describe("lib/supabase/client", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...envBackup };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockCreateBrowserClient.mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      from: vi.fn(),
      value: 123,
    });
  });

  it("getSupabase throws when env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const mod = await import("./client");

    expect(() => mod.getSupabase()).toThrow(
      "Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  });

  it("getSupabase throws when URL has placeholder", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co";
    const mod = await import("./client");

    expect(() => mod.getSupabase()).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL содержит плейсхолдер"
    );
  });

  it("getSupabase creates and caches browser client", async () => {
    const mod = await import("./client");

    const first = mod.getSupabase();
    const second = mod.getSupabase();

    expect(first).toBe(second);
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key"
    );
  });

  it("supabase proxy delegates properties and binds functions", async () => {
    const getSession = vi.fn().mockResolvedValue("ok");
    const from = vi.fn().mockReturnThis();
    mockCreateBrowserClient.mockReturnValue({
      auth: { getSession },
      from,
      value: 321,
    });

    const mod = await import("./client");

    expect((mod.supabase as any).value).toBe(321);
    await (mod.supabase as any).auth.getSession();
    (mod.supabase as any).from("tracks");

    expect(getSession).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("tracks");
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });
});
