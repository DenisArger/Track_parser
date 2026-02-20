/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "./ThemeToggle";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders and toggles to dark mode", () => {
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <ThemeToggle />
      </I18nProvider>
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("uses saved dark theme on initial render", () => {
    localStorage.setItem("theme", "dark");
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <ThemeToggle />
      </I18nProvider>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
