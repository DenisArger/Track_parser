import { describe, expect, it } from "vitest";
import {
  generateSafeFilename,
  normalizeForMatch,
  parseArtistTitleFromRawName,
} from "./filenameUtils";

describe("filenameUtils", () => {
  it("generateSafeFilename builds Artist - Title.mp3", () => {
    expect(
      generateSafeFilename({ artist: "ABBA", title: "Dancing Queen" })
    ).toBe("ABBA - Dancing Queen.mp3");
  });

  it("generateSafeFilename skips Unknown artist", () => {
    expect(generateSafeFilename({ artist: "Unknown", title: "Track" })).toBe(
      "Track.mp3"
    );
  });

  it("generateSafeFilename falls back to Unknown", () => {
    expect(generateSafeFilename({})).toBe("Unknown.mp3");
    expect(generateSafeFilename({ artist: "   ", title: " " })).toBe(
      "Unknown.mp3"
    );
  });

  it("generateSafeFilename removes invalid filesystem chars", () => {
    expect(
      generateSafeFilename({ artist: "A/B:C*", title: 'T?"<x>|' })
    ).toBe("A B C - T x.mp3");
  });

  it("generateSafeFilename truncates long names", () => {
    const long = "a".repeat(300);
    const out = generateSafeFilename({ title: long });
    expect(out.endsWith(".mp3")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(204);
  });

  it("normalizeForMatch lowercases, trims and strips .mp3", () => {
    expect(normalizeForMatch("ABBA - Dancing Queen.MP3")).toBe(
      "abba - dancing queen"
    );
    expect(normalizeForMatch("  Track  ")).toBe("track");
  });

  it("parseArtistTitleFromRawName parses Artist - Title", () => {
    expect(parseArtistTitleFromRawName("ABBA - Dancing Queen.mp3")).toEqual({
      artist: "ABBA",
      title: "Dancing Queen",
    });
  });

  it("parseArtistTitleFromRawName handles title-only and empty values", () => {
    expect(parseArtistTitleFromRawName("Only Title.mp3")).toEqual({
      artist: null,
      title: "Only Title",
    });
    expect(parseArtistTitleFromRawName("")).toEqual({
      artist: null,
      title: null,
    });
  });
});
