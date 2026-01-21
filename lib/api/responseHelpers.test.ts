import { describe, it, expect } from "vitest";
import { createSuccessResponse, createTrackResponse } from "./responseHelpers";

describe("createSuccessResponse", () => {
  it("returns success: true without data or message", async () => {
    const r = createSuccessResponse();
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j).not.toHaveProperty("data");
    expect(j).not.toHaveProperty("message");
  });

  it("includes data when provided", async () => {
    const r = createSuccessResponse({ id: "1" });
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.data).toEqual({ id: "1" });
  });

  it("includes message when provided", async () => {
    const r = createSuccessResponse(undefined, "OK");
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.message).toBe("OK");
  });

  it("includes both data and message", async () => {
    const r = createSuccessResponse({ x: 1 }, "Done");
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.data).toEqual({ x: 1 });
    expect(j.message).toBe("Done");
  });
});

describe("createTrackResponse", () => {
  it("returns success: true and track", async () => {
    const track = { id: "1", status: "downloaded" };
    const r = createTrackResponse(track);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.track).toEqual(track);
  });

  it("includes message when provided", async () => {
    const r = createTrackResponse({ id: "1" }, "Updated");
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.track).toEqual({ id: "1" });
    expect(j.message).toBe("Updated");
  });
});
