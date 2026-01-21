import { describe, it, expect } from "vitest";
import { formatTime, formatDuration } from "./timeFormatter";

describe("formatTime", () => {
  it("returns 0:00 for 0", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("returns 0:00 for negative numbers", () => {
    expect(formatTime(-1)).toBe("0:00");
  });

  it("returns 0:00 for NaN", () => {
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("formats 65 as 1:05", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formats 3661 as 61:01", () => {
    expect(formatTime(3661)).toBe("61:01");
  });

  it("formats 90 as 1:30", () => {
    expect(formatTime(90)).toBe("1:30");
  });
});

describe("formatDuration", () => {
  it("returns Unknown for undefined", () => {
    expect(formatDuration(undefined)).toBe("Unknown");
  });

  it("returns Unknown for 0", () => {
    expect(formatDuration(0)).toBe("Unknown");
  });

  it("formats number like formatTime", () => {
    expect(formatDuration(125)).toBe("2:05");
  });
});
