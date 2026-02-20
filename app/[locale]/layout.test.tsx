/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocaleLayout, { generateMetadata } from "./layout";

const mockGetAuthUser = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/i18n/getMessages", () => ({
  getMessages: (locale: string) => ({
    layout: {
      title: locale === "en" ? "Track Parser EN" : "Track Parser RU",
      subtitle: "Subtitle",
      login: "Login",
      signup: "Sign up",
      logout: "Logout",
    },
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: (...args: unknown[]) => mockNotFound(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../components/ThemeToggle", () => ({
  default: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

vi.mock("../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher">LocaleSwitcher</div>,
}));

vi.mock("../components/I18nProvider", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("LocaleLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateMetadata uses locale messages", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta).toEqual({
      title: "Track Parser EN",
      description: "Subtitle",
    });
  });

  it("generateMetadata falls back for unknown locale", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "xx" }) });
    expect(meta).toEqual({
      title: "Track Parser RU",
      description: "Subtitle",
    });
  });

  it("calls notFound for unsupported locale", async () => {
    await expect(
      LocaleLayout({
        children: <div>Child</div>,
        params: Promise.resolve({ locale: "xx" }),
      })
    ).rejects.toThrow("NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("renders login/signup links for guest user", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const ui = await LocaleLayout({
      children: <div>Home</div>,
      params: Promise.resolve({ locale: "en" }),
    });

    render(ui as any);
    expect(screen.getByText("Track Parser EN")).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.queryByText("Logout")).not.toBeInTheDocument();
  });

  it("renders user email and logout for authenticated user", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });
    const ui = await LocaleLayout({
      children: <div>Home</div>,
      params: Promise.resolve({ locale: "en" }),
    });

    render(ui as any);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });
});
