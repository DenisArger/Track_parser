import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleApiError,
  handleValidationError,
  handleNotFoundError,
} from "./errorHandler";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleApiError", () => {
  it("returns 500 with Error.message for Error", async () => {
    const r = handleApiError(new Error("fail"));
    expect(r.status).toBe(500);
    const j = await r.json();
    expect(j.error).toBe("fail");
    expect(j.success).toBe(false);
  });

  it("returns 500 with defaultMessage for non-Error", async () => {
    const r = handleApiError("x", "Default");
    expect(r.status).toBe(500);
    const j = await r.json();
    expect(j.error).toBe("Default");
    expect(j.success).toBe(false);
  });
});

describe("handleValidationError", () => {
  it("returns 400 with message", async () => {
    const r = handleValidationError("Invalid input");
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toBe("Invalid input");
    expect(j.success).toBe(false);
  });
});

describe("handleNotFoundError", () => {
  it("returns 404 with default message", async () => {
    const r = handleNotFoundError();
    expect(r.status).toBe(404);
    const j = await r.json();
    expect(j.error).toBe("Resource not found");
    expect(j.success).toBe(false);
  });

  it("returns 404 with custom message", async () => {
    const r = handleNotFoundError("Track not found");
    expect(r.status).toBe(404);
    const j = await r.json();
    expect(j.error).toBe("Track not found");
    expect(j.success).toBe(false);
  });
});
