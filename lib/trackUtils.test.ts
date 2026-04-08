import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackStats, cleanupTrackStatuses } from "./trackUtils";

const normalizePath = (value: string) => value.replace(/\\/g, "/");

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
      approved: 0,
      rejected: 0,
      readyForUpload: 0,
      uploaded: 0,
      uploadedRadio: 0,
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
      approved: 0,
      rejected: 0,
      readyForUpload: 0,
      uploaded: 0,
      uploadedRadio: 0,
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

  it("does not rewrite json when there is nothing to clean", async () => {
    vi.resetModules();
    const writeJson = vi.fn();
    vi.doMock("fs-extra", () => ({
      pathExists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue([{ id: "ok-1", metadata: {} }]),
      writeJson,
    }));
    vi.doMock("@/lib/utils/environment", () => ({
      getSafeWorkingDirectory: () => "/tmp",
    }));

    const mod = await import("./trackUtils");
    await mod.cleanupTrackStatuses();
    expect(writeJson).not.toHaveBeenCalled();
    expect(normalizePath("/tmp/tracks.json")).toBe("/tmp/tracks.json");
  });
});
