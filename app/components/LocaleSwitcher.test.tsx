/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocaleSwitcher from "./LocaleSwitcher";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: (...args: unknown[]) => mockUsePathname(...args),
}));

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders locale links and highlights current locale", () => {
    mockUsePathname.mockReturnValue("/en/tracks");
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <LocaleSwitcher />
      </I18nProvider>
    );

    const en = screen.getByRole("link", { name: "EN" });
    const ru = screen.getByRole("link", { name: "RU" });
    expect(en.getAttribute("href")).toBe("/en/tracks");
    expect(ru.getAttribute("href")).toBe("/ru/tracks");
    expect(en.getAttribute("aria-current")).toBe("page");
    expect(ru.getAttribute("aria-current")).toBeNull();
  });
});
