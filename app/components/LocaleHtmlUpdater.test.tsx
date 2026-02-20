/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocaleHtmlUpdater from "./LocaleHtmlUpdater";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: (...args: unknown[]) => mockUsePathname(...args),
}));

describe("LocaleHtmlUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = "ru";
  });

  it("sets html lang from locale segment", () => {
    mockUsePathname.mockReturnValue("/en/tracks");
    render(<LocaleHtmlUpdater />);
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to default locale for unknown path", () => {
    mockUsePathname.mockReturnValue("/unknown/page");
    render(<LocaleHtmlUpdater />);
    expect(document.documentElement.lang).toBe("ru");
  });
});
