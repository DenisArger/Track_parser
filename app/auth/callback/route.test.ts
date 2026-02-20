import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockExchangeCodeForSession = vi.fn();
const mockCreateSupabaseAuthServerClient = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAuthServerClient: (...args: unknown[]) =>
    mockCreateSupabaseAuthServerClient(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSupabaseAuthServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    });
    mockExchangeCodeForSession.mockResolvedValue(undefined);
  });

  it("exchanges code and redirects to provided next path", async () => {
    const req = new Request(
      "http://localhost/auth/callback?code=abc123&next=/dashboard"
    );

    await GET(req as never);

    expect(mockCreateSupabaseAuthServerClient).toHaveBeenCalledTimes(1);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to root when no next parameter", async () => {
    const req = new Request("http://localhost/auth/callback?code=abc123");

    await GET(req as never);

    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("skips code exchange when code is missing", async () => {
    const req = new Request("http://localhost/auth/callback?next=/tracks");

    await GET(req as never);

    expect(mockCreateSupabaseAuthServerClient).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/tracks");
  });
});
