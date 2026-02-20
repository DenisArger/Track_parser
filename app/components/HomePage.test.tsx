/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockGetAllTracks = vi.fn();
const mockUseTracksRealtime = vi.fn();
const mockGetUserFacingErrorMessage = vi.fn((e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback
);
const mockGetSupabase = vi.fn();
const mockFetch = vi.fn();
const mockChangeTrackStatusAction = vi.fn();

vi.mock("./DownloadTrack", () => ({
  default: () => <div>DownloadTrackMock</div>,
}));

vi.mock("./TrackPlayer", () => ({
  default: () => <div>TrackPlayerMock</div>,
}));

vi.mock("./MetadataEditor", () => ({
  default: () => <div>MetadataEditorMock</div>,
}));

vi.mock("./FtpUploader", () => ({
  default: () => <div>FtpUploaderMock</div>,
}));

vi.mock("./TrackManager", () => ({
  default: () => <div>TrackManagerMock</div>,
}));

vi.mock("./PlayList", () => ({
  default: () => <div>PlayListMock</div>,
}));

vi.mock("./shared/TrackStatusBadge", () => ({
  default: ({ status }: { status: string }) => <span>status:{status}</span>,
}));

vi.mock("@/lib/actions/trackActions", () => ({
  getAllTracks: (...args: unknown[]) => mockGetAllTracks(...args),
  changeTrackStatusAction: (...args: unknown[]) =>
    mockChangeTrackStatusAction(...args),
}));

vi.mock("@/lib/hooks/useTracksRealtime", () => ({
  useTracksRealtime: (...args: unknown[]) => mockUseTracksRealtime(...args),
}));

vi.mock("@/lib/utils/errorMessage", () => ({
  getUserFacingErrorMessage: (...args: unknown[]) =>
    mockGetUserFacingErrorMessage(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);

    mockGetAllTracks.mockResolvedValue([
      {
        id: "t1",
        filename: "Song.mp3",
        status: "downloaded",
        metadata: { title: "Song", artist: "Artist", genre: "Средний", year: 2026, rating: 5 },
      },
    ]);
    mockGetSupabase.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "user@example.com" } },
        }),
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ onRadio: { t1: true }, count: 0 }),
    });
    mockChangeTrackStatusAction.mockResolvedValue({ ok: true });
  });

  function renderPage() {
    return render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <HomePage />
      </I18nProvider>
    );
  }

  it("renders default tab and overview data for non-admin user", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("DownloadTrackMock")).toBeInTheDocument();
    });
    expect(screen.getByText("Tracks Overview")).toBeInTheDocument();
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Track Manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Playlist" })).not.toBeInTheDocument();
  });

  it("shows admin tabs and switches to Track Manager", async () => {
    mockGetSupabase.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "den.arger@gmail.com" } },
        }),
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Track Manager" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Track Manager" }));
    expect(screen.getByText("TrackManagerMock")).toBeInTheDocument();
  });

  it("syncs radio tracks and shows success message", async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/radio/sync")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ count: 2 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ onRadio: { t1: true }, count: 0 }),
      });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sync with radio" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Sync with radio" }));

    await waitFor(() => {
      expect(screen.getByText("Loaded 2 tracks into the database.")).toBeInTheDocument();
    });
  });

  it("shows sync error and handles clear error action", async () => {
    mockGetAllTracks.mockResolvedValue([
      {
        id: "t1",
        filename: "Song.mp3",
        status: "error",
        processedPath: "",
        error: "broken state",
        metadata: { title: "Song", artist: "Artist", genre: "Средний", year: 2026, rating: 5 },
      },
    ]);
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/radio/sync")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "sync failed" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ onRadio: {}, count: 0 }),
      });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Error: broken state")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear error" }));
    await waitFor(() => {
      expect(mockChangeTrackStatusAction).toHaveBeenCalledWith("t1", "downloaded");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sync with radio" }));
    await waitFor(() => {
      expect(screen.getByText("sync failed")).toBeInTheDocument();
    });
  });
});
