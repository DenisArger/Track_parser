import { describe, expect, it } from "vitest";
import { getLocaleFromPathname, withLocalePath } from "./path";

describe("i18n path helpers", () => {
  it("extracts locale from pathname when present", () => {
    expect(getLocaleFromPathname("/ru/tracks")).toBe("ru");
    expect(getLocaleFromPathname("/en")).toBe("en");
  });

  it("returns default locale when pathname has no locale", () => {
    expect(getLocaleFromPathname("/tracks")).toBe("ru");
    expect(getLocaleFromPathname("/")).toBe("ru");
  });

  it("replaces existing locale segment", () => {
    expect(withLocalePath("/ru/tracks", "en")).toBe("/en/tracks");
  });

  it("inserts locale when missing", () => {
    expect(withLocalePath("/tracks", "en")).toBe("/en/tracks");
    expect(withLocalePath("tracks", "ru")).toBe("/tracks/ru");
  });
});
