import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

const LocaleHtmlUpdaterMock = vi.fn(() => null);

vi.mock("./components/LocaleHtmlUpdater", () => ({
  default: (...args: unknown[]) => LocaleHtmlUpdaterMock(...args),
}));

describe("RootLayout", () => {
  it("renders html/body wrapper and includes children", () => {
    const tree = RootLayout({ children: <div id="child">Child</div> }) as any;

    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("ru");

    const body = tree.props.children;
    expect(body.type).toBe("body");
    expect(String(body.props.className)).toContain("bg-gray-50");
  });
});
