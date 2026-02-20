import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRadioTrack,
  getRadioTrackNamesSet,
  syncRadioTracksFromApi,
} from "./radioTracks";

const mockCreateSupabaseServerClient = vi.fn();
const mockSyncFromApi = vi.fn();
const mockParseArtistTitleFromRawName = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("./streamingCenterClient", () => ({
  syncFromApi: (...args: unknown[]) => mockSyncFromApi(...args),
}));

vi.mock("@/lib/utils/filenameUtils", () => ({
  parseArtistTitleFromRawName: (...args: unknown[]) =>
    mockParseArtistTitleFromRawName(...args),
}));

describe("radioTracks", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env = { ...envBackup };
    process.env.STREAMING_CENTER_API_URL = "https://sc.example.com";
    process.env.STREAMING_CENTER_API_KEY = "key";
    process.env.STREAMING_CENTER_PLAYLIST_ID = "5";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";

    mockSelect.mockResolvedValue({ data: [{ normalized_name: "abba-track" }] });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: (...args: unknown[]) => mockSelect(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    });
    mockCreateSupabaseServerClient.mockReturnValue({
      from: (...args: unknown[]) => mockFrom(...args),
    });
    mockParseArtistTitleFromRawName.mockReturnValue({
      artist: "Parsed Artist",
      title: "Parsed Title",
    });
  });

  it("getRadioTrackNamesSet returns data from DB when it is not empty", async () => {
    const set = await getRadioTrackNamesSet();

    expect(set).toEqual(new Set(["abba-track"]));
    expect(mockSyncFromApi).not.toHaveBeenCalled();
  });

  it("getRadioTrackNamesSet syncs from API when DB set is empty", async () => {
    mockSelect.mockResolvedValue({ data: [] });
    mockSyncFromApi.mockResolvedValue([
      {
        normalizedName: "n1",
        rawName: "A - B.mp3",
        artist: null,
        title: null,
        trackType: "Быстрый",
        year: 2020,
        rating: 8,
      },
    ]);

    const set = await getRadioTrackNamesSet();

    expect(mockSyncFromApi).toHaveBeenCalledWith(
      "https://sc.example.com",
      "key",
      5
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          normalized_name: "n1",
          raw_name: "A - B.mp3",
          artist: "Parsed Artist",
          title: "Parsed Title",
          track_type: "Быстрый",
          year: 2020,
          rating: 8,
          source: "api_sync",
        },
      ],
      { onConflict: "normalized_name" }
    );
    expect(set).toEqual(new Set(["n1"]));
  });

  it("syncRadioTracksFromApi throws when env vars are missing", async () => {
    delete process.env.STREAMING_CENTER_API_KEY;

    await expect(syncRadioTracksFromApi()).rejects.toThrow(
      "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы"
    );
  });

  it("syncRadioTracksFromApi deduplicates entries and returns count", async () => {
    mockSyncFromApi.mockResolvedValue([
      { normalizedName: "n1", rawName: "a.mp3", artist: "A", title: "B" },
      { normalizedName: "n1", rawName: "a.mp3", artist: "A", title: "B" },
      { normalizedName: "n2", rawName: "c.mp3", artist: "C", title: "D" },
    ]);

    const result = await syncRadioTracksFromApi();

    expect(result).toEqual({ count: 3 });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockUpsert.mock.calls[0][0] as Array<{ normalized_name: string }>;
    expect(upsertArg).toHaveLength(2);
    expect(upsertArg.map((i) => i.normalized_name).sort()).toEqual(["n1", "n2"]);
  });

  it("syncRadioTracksFromApi wraps supabase errors", async () => {
    mockSyncFromApi.mockResolvedValue([{ normalizedName: "n1", rawName: "a.mp3" }]);
    mockUpsert.mockResolvedValue({ error: { message: "db down" } });

    await expect(syncRadioTracksFromApi()).rejects.toThrow(
      "Ошибка записи в radio_tracks: db down"
    );
  });

  it("addRadioTrack writes with defaults and ignoreDuplicates", async () => {
    await addRadioTrack({
      normalizedName: "n1",
      rawName: "Raw Name.mp3",
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        normalized_name: "n1",
        raw_name: "Raw Name.mp3",
        artist: "Parsed Artist",
        title: "Parsed Title",
        track_type: null,
        year: null,
        rating: null,
        source: "ftp_upload",
      },
      { onConflict: "normalized_name", ignoreDuplicates: true }
    );
  });
});
