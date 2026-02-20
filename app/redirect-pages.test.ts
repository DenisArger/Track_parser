import { beforeEach, describe, expect, it, vi } from "vitest";
import RootPage from "./page";
import LoginRedirectPage from "./login/page";
import SignupRedirectPage from "./signup/page";
import ForgotPasswordRedirectPage from "./forgot-password/page";
import { defaultLocale } from "@/lib/i18n/config";

const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("redirect pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects root page to locale root", () => {
    RootPage();
    expect(mockRedirect).toHaveBeenCalledWith(`/${defaultLocale}`);
  });

  it("redirects /login to locale login", () => {
    LoginRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith(`/${defaultLocale}/login`);
  });

  it("redirects /signup to locale signup", () => {
    SignupRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith(`/${defaultLocale}/signup`);
  });

  it("redirects /forgot-password to locale forgot-password", () => {
    ForgotPasswordRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith(`/${defaultLocale}/forgot-password`);
  });
});
