import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkTracksOnRadio,
  getAllPlaylistTrackNames,
  syncFromApi,
} from "./streamingCenterClient";

const mockNormalizeForMatch = vi.fn();
const mockGenerateSafeFilename = vi.fn();
const mockParseArtistTitleFromRawName = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/utils/filenameUtils", () => ({
  normalizeForMatch: (...args: unknown[]) => mockNormalizeForMatch(...args),
  generateSafeFilename: (...args: unknown[]) => mockGenerateSafeFilename(...args),
  parseArtistTitleFromRawName: (...args: unknown[]) =>
    mockParseArtistTitleFromRawName(...args),
}));

describe("streamingCenterClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockFetch);
    mockNormalizeForMatch.mockImplementation((s: string) =>
      (s || "")
        .toLowerCase()
        .trim()
        .replace(/\.mp3$/i, "")
    );
  });

  it("getAllPlaylistTrackNames loads paginated data", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      filename: `Track${i + 1}.mp3`,
    }));
    const secondPage = [{ filename: "Last.mp3" }];

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstPage), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondPage), { status: 200 })
      );

    const result = await getAllPlaylistTrackNames(
      "https://api.example.com/api/v2",
      "key",
      5
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.has("track1")).toBe(true);
    expect(result.has("last")).toBe(true);
  });

  it("getAllPlaylistTrackNames supports object payload with results", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ results: [{ track: { path: "/a/b/c.mp3" } }] }), {
        status: 200,
      })
    );

    const result = await getAllPlaylistTrackNames("https://api.example.com", "key", 1);

    expect(result).toEqual(new Set(["c"]));
  });

  it("getAllPlaylistTrackNames supports alternative list keys and row fallbacks", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { name: " Named.mp3 " },
            { public_path: "/radio/path/FromPath.mp3" },
            { track: { public_path: "C:\\music\\Nested.mp3" } },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await getAllPlaylistTrackNames(" https://api.example.com/ ", "key", 2);

    expect(result).toEqual(new Set(["named", "frompath", "nested"]));
  });

  it("getAllPlaylistTrackNames throws on non-ok response", async () => {
    mockFetch.mockResolvedValue(new Response("bad", { status: 500, statusText: "ERR" }));

    await expect(
      getAllPlaylistTrackNames("https://api.example.com", "key", 1)
    ).rejects.toThrow("Streaming.Center API error: 500 ERR");
  });

  it("syncFromApi extracts metadata and fallback artist/title", async () => {
    mockParseArtistTitleFromRawName.mockReturnValue({
      artist: "Fallback Artist",
      title: "Fallback Title",
    });
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              filename: "Main.mp3",
              track: {
                filename: "Main.mp3",
                meta: JSON.stringify({
                  track_type: "fast",
                  year: "2022",
                  track_number: "7",
                }),
              },
              comment: "модерн",
            },
          ],
        }),
        { status: 200 }
      )
    );

    const entries = await syncFromApi("https://api.example.com", "key", 1);

    expect(entries).toEqual([
      {
        normalizedName: "main",
        rawName: "Main.mp3",
        artist: "Fallback Artist",
        title: "Fallback Title",
        trackType: "Быстрый",
        year: 2022,
        rating: 7,
      },
    ]);
  });

  it("syncFromApi warns when rows contain no usable names", async () => {
    mockNormalizeForMatch.mockReturnValue("");
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify([{ unknown: "field" }]), { status: 200 })
    );

    const entries = await syncFromApi("https://api.example.com", "key", 1);

    expect(entries).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("syncFromApi uses comment/meta fallbacks for trackType/year/rating", async () => {
    mockParseArtistTitleFromRawName.mockReturnValue({
      artist: "Parsed Artist",
      title: "Parsed Title",
    });
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          playlist_files: [
            {
              filename: "Fallback.mp3",
              track: {
                filename: "Fallback.mp3",
                meta: "{broken-json",
                comment: "this one is modern",
              },
              year: "2021",
              track_number: "10/10",
            },
          ],
        }),
        { status: 200 }
      )
    );

    const entries = await syncFromApi("https://api.example.com/api/v2", "key", 1);

    expect(entries).toEqual([
      {
        normalizedName: "fallback",
        rawName: "Fallback.mp3",
        artist: "Parsed Artist",
        title: "Parsed Title",
        trackType: "Модерн",
        year: 2021,
        rating: 10,
      },
    ]);
  });

  it("syncFromApi throws on non-ok response", async () => {
    mockFetch.mockResolvedValue(new Response("bad", { status: 502, statusText: "Bad Gateway" }));

    await expect(syncFromApi("https://api.example.com", "key", 1)).rejects.toThrow(
      "Streaming.Center API error: 502 Bad Gateway"
    );
  });

  it("syncFromApi supports pagination and increments offset", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      filename: `Page1_${i + 1}.mp3`,
    }));
    const secondPage = [{ filename: "Page2_last.mp3" }];

    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200 }));

    const entries = await syncFromApi("https://api.example.com", "key", 77);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect((mockFetch.mock.calls[0] as [string])[0]).toContain("offset=0");
    expect((mockFetch.mock.calls[1] as [string])[0]).toContain("offset=1000");
    expect(entries).toHaveLength(1001);
    expect(entries[0].normalizedName).toBe("page1_1");
    expect(entries[1000].normalizedName).toBe("page2_last");
  });

  it("syncFromApi reads metadata from row-level fields and JSON meta", async () => {
    mockParseArtistTitleFromRawName.mockReturnValue({
      artist: "Raw Artist",
      title: "Raw Title",
    });
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          tracks: [
            {
              name: "RowLevel.mp3",
              artist: "Row Artist",
              title: "Row Title",
              genre: "Медленный",
              year: 2020,
              no: 5,
              meta: JSON.stringify({
                ARTIST: "Meta Artist",
                TITLE: "Meta Title",
                type: "modern",
                date: "2023",
                rating: "9",
              }),
            },
          ],
        }),
        { status: 200 }
      )
    );

    const entries = await syncFromApi("https://api.example.com", "key", 1);

    expect(entries).toEqual([
      {
        normalizedName: "rowlevel",
        rawName: "RowLevel.mp3",
        artist: "Row Artist",
        title: "Row Title",
        trackType: "Медленный",
        year: 2020,
        rating: 5,
      },
    ]);
  });

  it("checkTracksOnRadio returns map by normalized generated names", () => {
    mockGenerateSafeFilename
      .mockReturnValueOnce("ABBA - Dancing Queen.mp3")
      .mockReturnValueOnce("Muse - Starlight.mp3");

    const result = checkTracksOnRadio(
      [
        { id: "t1", metadata: { artist: "ABBA", title: "Dancing Queen" } },
        { id: "t2", metadata: { artist: "Muse", title: "Starlight" } },
      ],
      new Set(["abba - dancing queen"])
    );

    expect(result).toEqual({ t1: true, t2: false });
  });

  it("checkTracksOnRadio returns false when normalized key is empty", () => {
    mockGenerateSafeFilename.mockReturnValue("Unknown");
    mockNormalizeForMatch.mockReturnValue("");

    const result = checkTracksOnRadio(
      [{ id: "t3", metadata: { artist: "A", title: "B" } }],
      new Set(["anything"])
    );

    expect(result).toEqual({ t3: false });
  });
});
