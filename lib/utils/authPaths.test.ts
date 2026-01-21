import { describe, it, expect } from "vitest";
import { isPublicPath } from "./authPaths";

describe("isPublicPath", () => {
  it("returns true for /login", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("returns true for /signup", () => {
    expect(isPublicPath("/signup")).toBe(true);
  });

  it("returns true for /forgot-password", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
  });

  it("returns true for /auth/callback", () => {
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("returns true for /_next/...", () => {
    expect(isPublicPath("/_next/static/x")).toBe(true);
  });

  it("returns true for /favicon.ico", () => {
    expect(isPublicPath("/favicon.ico")).toBe(true);
  });

  it("returns true for path starting with /favicon.", () => {
    expect(isPublicPath("/favicon.svg")).toBe(true);
  });

  it("returns false for /", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("returns false for /tracks", () => {
    expect(isPublicPath("/tracks")).toBe(false);
  });
});
