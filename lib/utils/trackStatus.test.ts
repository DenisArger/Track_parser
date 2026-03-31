import { describe, expect, it } from "vitest";
import { normalizeTrackStatus } from "./trackStatus";

describe("normalizeTrackStatus", () => {
  it("maps legacy uploaded to ready_for_upload", () => {
    expect(normalizeTrackStatus("uploaded")).toBe("ready_for_upload");
  });

  it("maps legacy processed to reviewed_approved", () => {
    expect(normalizeTrackStatus("processed")).toBe("reviewed_approved");
  });
});
