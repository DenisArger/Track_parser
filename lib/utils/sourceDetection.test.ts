import { describe, it, expect } from "vitest";
import { detectSourceFromUrl } from "./sourceDetection";

describe("detectSourceFromUrl", () => {
  it("returns youtube-music for music.youtube.com", () => {
    expect(detectSourceFromUrl("https://music.youtube.com/watch?v=x")).toBe(
      "youtube-music"
    );
  });

  it("returns youtube for youtube.com", () => {
    expect(detectSourceFromUrl("https://www.youtube.com/watch?v=x")).toBe(
      "youtube"
    );
  });

  it("returns youtube for youtu.be", () => {
    expect(detectSourceFromUrl("https://youtu.be/x")).toBe("youtube");
  });

  it("returns youtube for unknown URL", () => {
    expect(detectSourceFromUrl("https://example.com/audio")).toBe("youtube");
  });
});
