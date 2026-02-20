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

  it("returns zeros during Next.js production build phase", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
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

  it("counts statuses and trimmed tracks correctly", async () => {
    vi.resetModules();
    vi.doMock("fs-extra", () => ({
      pathExists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue([
        {
          id: "d1",
          status: "downloaded",
          metadata: { ...baseMeta, isTrimmed: false },
        },
        {
          id: "p1",
          status: "processed",
          metadata: {
            ...baseMeta,
            isTrimmed: true,
            trimSettings: { startTime: 10, fadeIn: 0, fadeOut: 0 },
          },
        },
        {
          id: "r1",
          status: "rejected",
          metadata: { ...baseMeta, isTrimmed: false },
        },
      ]),
    }));
    vi.doMock("@/lib/utils/environment", () => ({
      getSafeWorkingDirectory: () => "/tmp",
    }));

    const mod = await import("./trackUtils");
    const stats = await mod.getTrackStats();
    expect(stats).toEqual({
      total: 3,
      downloaded: 1,
      processed: 1,
      trimmed: 1,
      rejected: 1,
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

  it("returns early in build phase", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    const mod = await import("./trackUtils");
    await expect(mod.cleanupTrackStatuses()).resolves.toBeUndefined();
  });

  it("writes updated json when invalid trim flags are found", async () => {
    vi.resetModules();
    const writeJson = vi.fn();
    vi.doMock("fs-extra", () => ({
      pathExists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue([
        {
          id: "t1",
          metadata: {
            ...baseMeta,
            isTrimmed: true,
            trimSettings: { startTime: 0, fadeIn: 0, fadeOut: 0 },
          },
        },
        {
          id: "t2",
          metadata: {
            ...baseMeta,
            isTrimmed: false,
            trimSettings: { startTime: 5, fadeIn: 0, fadeOut: 0 },
          },
        },
      ]),
      writeJson,
    }));
    vi.doMock("@/lib/utils/environment", () => ({
      getSafeWorkingDirectory: () => "/tmp",
    }));

    const mod = await import("./trackUtils");
    await mod.cleanupTrackStatuses();

    expect(writeJson).toHaveBeenCalledWith(
      "/tmp/tracks.json",
      expect.arrayContaining([
        expect.objectContaining({
          id: "t1",
          metadata: expect.not.objectContaining({ isTrimmed: true }),
        }),
      ]),
      { spaces: 2 }
    );
  });

  it("does not write json when no cleanup is needed", async () => {
    vi.resetModules();
    const writeJson = vi.fn();
    vi.doMock("fs-extra", () => ({
      pathExists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue([
        {
          id: "ok-1",
          metadata: {
            ...baseMeta,
            isTrimmed: true,
            trimSettings: { startTime: 10, fadeIn: 0, fadeOut: 0 },
          },
        },
      ]),
      writeJson,
    }));
    vi.doMock("@/lib/utils/environment", () => ({
      getSafeWorkingDirectory: () => "/tmp",
    }));

    const mod = await import("./trackUtils");
    await mod.cleanupTrackStatuses();
    expect(writeJson).not.toHaveBeenCalled();
  });
});
