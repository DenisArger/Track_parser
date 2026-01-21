import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTrackActuallyTrimmed,
  getTrackStats,
  cleanupTrackStatuses,
} from "./trackUtils";
import type { TrackMetadata } from "@/types/track";

const baseMeta: TrackMetadata = {
  title: "",
  artist: "",
  album: "",
  genre: "Средний",
  rating: 5,
  year: 2024,
};

describe("isTrackActuallyTrimmed", () => {
  it("returns false when isTrimmed is false", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: false,
        trimSettings: { startTime: 10, fadeIn: 0, fadeOut: 0 },
      })
    ).toBe(false);
  });

  it("returns false when isTrimmed true but no trimSettings", () => {
    expect(isTrackActuallyTrimmed({ ...baseMeta, isTrimmed: true })).toBe(
      false
    );
  });

  it("returns false when isTrimmed true and trimSettings are all empty", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: { startTime: 0, fadeIn: 0, fadeOut: 0 },
      })
    ).toBe(false);
  });

  it("returns true when startTime > 0", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: { startTime: 5, fadeIn: 0, fadeOut: 0 },
      })
    ).toBe(true);
  });

  it("returns true when endTime is defined", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: { startTime: 0, endTime: 180, fadeIn: 0, fadeOut: 0 },
      })
    ).toBe(true);
  });

  it("returns true when fadeIn > 0", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: { startTime: 0, fadeIn: 1, fadeOut: 0 },
      })
    ).toBe(true);
  });

  it("returns true when fadeOut > 0", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: { startTime: 0, fadeIn: 0, fadeOut: 2 },
      })
    ).toBe(true);
  });

  it("returns true when maxDuration < 360", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: {
          startTime: 0,
          fadeIn: 0,
          fadeOut: 0,
          maxDuration: 300,
        },
      })
    ).toBe(true);
  });

  it("returns false when maxDuration >= 360", () => {
    expect(
      isTrackActuallyTrimmed({
        ...baseMeta,
        isTrimmed: true,
        trimSettings: {
          startTime: 0,
          fadeIn: 0,
          fadeOut: 0,
          maxDuration: 360,
        },
      })
    ).toBe(false);
  });
});

describe("getTrackStats", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PHASE;
    vi.doMock("fs-extra", () => ({
      pathExists: vi.fn().mockResolvedValue(false),
      readJson: vi.fn(),
    }));
    vi.doMock("@/lib/utils/environment", () => ({
      getSafeWorkingDirectory: () => "/tmp",
    }));
  });

  it("returns zeros when tracks.json does not exist", async () => {
    const mod = await import("./trackUtils");
    const stats = await mod.getTrackStats();
    expect(stats).toEqual({
      total: 0,
      downloaded: 0,
      processed: 0,
      trimmed: 0,
      rejected: 0,
    });
  });
});

describe("cleanupTrackStatuses", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PHASE;
    vi.doMock("fs-extra", () => ({
      pathExists: vi.fn().mockResolvedValue(false),
      readJson: vi.fn(),
      writeJson: vi.fn(),
    }));
    vi.doMock("@/lib/utils/environment", () => ({
      getSafeWorkingDirectory: () => "/tmp",
    }));
  });

  it("does not throw when tracks.json does not exist", async () => {
    const mod = await import("./trackUtils");
    await expect(mod.cleanupTrackStatuses()).resolves.toBeUndefined();
  });
});
