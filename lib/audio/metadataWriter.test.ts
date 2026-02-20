import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeTrackTags } from "./metadataWriter";

const mockWrite = vi.fn();

vi.mock("node-id3", () => ({
  default: {
    write: (...args: unknown[]) => mockWrite(...args),
  },
}));

describe("metadataWriter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes tags and returns true", async () => {
    mockWrite.mockReturnValue(true);

    const result = await writeTrackTags("/tmp/file.mp3", {
      title: "Song",
      artist: "Artist",
      album: "Album",
      genre: "Средний",
      rating: 8,
      year: 2024,
    } as never);

    expect(result).toBe(true);
    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Song",
        artist: "Artist",
        album: "Album",
        genre: "Средний",
        year: "2024",
        comment: { language: "eng", text: "Рейтинг: 8" },
      }),
      "/tmp/file.mp3"
    );
  });

  it("throws when node-id3 returns Error", async () => {
    mockWrite.mockReturnValue(new Error("id3 fail"));

    await expect(
      writeTrackTags("/tmp/file.mp3", {
        title: "Song",
        artist: "Artist",
        album: "",
        genre: "Средний",
        rating: 1,
        year: 2020,
      } as never)
    ).rejects.toThrow("id3 fail");
  });
});
