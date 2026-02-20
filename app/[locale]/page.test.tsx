/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";
import LocaleHomePage from "./page";
import LocaleLoginPage from "./login/page";
import LocaleSignupPage from "./signup/page";
import LocaleForgotPasswordPage from "./forgot-password/page";

vi.mock("../components/HomePage", () => ({
  default: () => <div>HomePageMock</div>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/login",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  }),
}));

describe("locale wrapper pages", () => {
  const renderWithI18n = (ui: React.ReactNode) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        {ui}
      </I18nProvider>
    );

  it("renders locale home page wrapper", () => {
    render(<LocaleHomePage />);
    expect(screen.getByText("HomePageMock")).toBeInTheDocument();
  });

  it("renders locale login page wrapper", () => {
    renderWithI18n(<LocaleLoginPage />);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders locale signup page wrapper", () => {
    renderWithI18n(<LocaleSignupPage />);
    expect(screen.getByText("Create account")).toBeInTheDocument();
  });

  it("renders locale forgot-password page wrapper", () => {
    renderWithI18n(<LocaleForgotPasswordPage />);
    expect(screen.getByText("Password recovery")).toBeInTheDocument();
  });
});
