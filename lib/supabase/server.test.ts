import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseAuthServerClient,
  createSupabaseServerClient,
  getAuthUser,
  requireAuth,
} from "./server";

const mockCreateClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockCookies = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock("next/headers", () => ({
  cookies: (...args: unknown[]) => mockCookies(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("lib/supabase/server", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...envBackup };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    mockCreateClient.mockReturnValue({ ok: true });
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    });
    mockCookies.mockResolvedValue({
      getAll: vi.fn().mockReturnValue([{ name: "a", value: "b" }]),
      set: vi.fn(),
    });
    mockRedirect.mockImplementation(() => {
      throw new Error("REDIRECTED");
    });
  });

  it("createSupabaseServerClient throws when env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => createSupabaseServerClient()).toThrow(
      "Missing Supabase environment variables"
    );
  });

  it("createSupabaseServerClient throws when URL has placeholder", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co";

    expect(() => createSupabaseServerClient()).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL содержит плейсхолдер"
    );
  });

  it("createSupabaseServerClient calls createClient with auth options", () => {
    const client = createSupabaseServerClient();

    expect(client).toEqual({ ok: true });
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  });

  it("createSupabaseAuthServerClient throws when anon env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(createSupabaseAuthServerClient()).rejects.toThrow(
      "Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  });

  it("createSupabaseAuthServerClient configures SSR cookies adapter", async () => {
    const cookieStore = {
      getAll: vi.fn().mockReturnValue([{ name: "x", value: "y" }]),
      set: vi.fn(),
    };
    mockCookies.mockResolvedValue(cookieStore);

    await createSupabaseAuthServerClient();

    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
    const config = mockCreateServerClient.mock.calls[0][2] as {
      cookies: {
        getAll: () => unknown;
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: object }>) => void;
      };
    };
    expect(config.cookies.getAll()).toEqual([{ name: "x", value: "y" }]);
    config.cookies.setAll([{ name: "n", value: "v" }]);
    expect(cookieStore.set).toHaveBeenCalledWith("n", "v", undefined);
  });

  it("getAuthUser returns user and returns null on error", async () => {
    const user = await getAuthUser();
    expect(user).toEqual({ id: "u1" });

    mockCreateServerClient.mockImplementationOnce(() => {
      throw new Error("auth fail");
    });
    await expect(getAuthUser()).resolves.toBeNull();
  });

  it("requireAuth returns user or redirects to login", async () => {
    await expect(requireAuth()).resolves.toEqual({ id: "u1" });

    mockCreateServerClient.mockReturnValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    await expect(requireAuth()).rejects.toThrow("REDIRECTED");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
