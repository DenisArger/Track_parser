import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoutAction } from "./authActions";

const mockSignOut = vi.fn();
const mockCreateSupabaseAuthServerClient = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAuthServerClient: (...args: unknown[]) =>
    mockCreateSupabaseAuthServerClient(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockCreateSupabaseAuthServerClient.mockResolvedValue({
      auth: { signOut: mockSignOut },
    });
  });

  it("signs out and redirects to login", async () => {
    await logoutAction();

    expect(mockCreateSupabaseAuthServerClient).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
