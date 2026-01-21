import { describe, it, expect } from "vitest";
import { formatTime, formatDuration, formatTimeMs, parseTimeMs } from "./timeFormatter";

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

describe("formatTimeMs", () => {
  it("returns 0:00.00 for 0", () => {
    expect(formatTimeMs(0)).toBe("0:00.00");
  });

  it("returns 0:00.00 for negative or NaN", () => {
    expect(formatTimeMs(-1)).toBe("0:00.00");
    expect(formatTimeMs(NaN)).toBe("0:00.00");
  });

  it("formats 70.25 as 1:10.25", () => {
    expect(formatTimeMs(70.25)).toBe("1:10.25");
  });

  it("formats integer seconds with .00", () => {
    expect(formatTimeMs(65)).toBe("1:05.00");
  });

  it("formats tenths and hundredths", () => {
    expect(formatTimeMs(1.1)).toBe("0:01.10");
    expect(formatTimeMs(90.99)).toBe("1:30.99");
  });
});

describe("parseTimeMs", () => {
  it("returns fallback for empty or invalid", () => {
    expect(parseTimeMs("", 5)).toBe(5);
    expect(parseTimeMs("  ", 5)).toBe(5);
    expect(parseTimeMs("abc", 0)).toBe(0);
    expect(parseTimeMs("1:60", 0)).toBe(0);
  });

  it("parses M:SS", () => {
    expect(parseTimeMs("1:05", 0)).toBe(65);
    expect(parseTimeMs("0:00", 0)).toBe(0);
  });

  it("parses M:SS.s and M:SS.ss", () => {
    expect(parseTimeMs("1:10.25", 0)).toBeCloseTo(70.25);
    expect(parseTimeMs("0:01.1", 0)).toBeCloseTo(1.1);
  });
});
