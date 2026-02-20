/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DownloadTrack from "./DownloadTrack";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockDownloadTrackAction = vi.fn();
const mockGetUserFacingErrorMessage = vi.fn(
  (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
);
const mockFetch = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  downloadTrackAction: (...args: unknown[]) => mockDownloadTrackAction(...args),
}));

vi.mock("@/lib/utils/errorMessage", () => ({
  getUserFacingErrorMessage: (...args: unknown[]) =>
    mockGetUserFacingErrorMessage(...args),
}));

describe("DownloadTrack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const renderWithI18n = (ui: React.ReactNode) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        {ui}
      </I18nProvider>
    );

  const baseTracks = [
    {
      id: "d1",
      filename: "Song.mp3",
      status: "downloaded",
      metadata: {
        title: "Song",
        artist: "Artist",
        genre: "Средний",
        year: 2026,
        rating: 5,
      },
    },
    {
      id: "p1",
      filename: "Processing.mp3",
      status: "downloading",
      downloadProgress: 42,
      metadata: {
        title: "Processing",
        artist: "Artist",
        genre: "Средний",
        year: 2026,
        rating: 5,
      },
    },
  ] as any;

  it("renders track sections and validates empty URL", async () => {
    renderWithI18n(
      <DownloadTrack onTracksUpdate={vi.fn()} tracks={baseTracks} />
    );

    expect(screen.getByText("Download Tracks")).toBeInTheDocument();
    expect(screen.getByText("Downloading Tracks")).toBeInTheDocument();
    expect(screen.getByText("Recently Downloaded")).toBeInTheDocument();

    const downloadButton = screen.getByRole("button", { name: "Download Track" });
    expect(downloadButton).toBeDisabled();
  });

  it("downloads track by URL and calls onTracksUpdate", async () => {
    const onTracksUpdate = vi.fn();
    mockDownloadTrackAction.mockResolvedValue({
      ok: true,
      track: { id: "new-1" },
    });
    renderWithI18n(
      <DownloadTrack onTracksUpdate={onTracksUpdate} tracks={[]} />
    );

    fireEvent.change(screen.getByLabelText("Track URL"), {
      target: { value: "https://youtube.com/watch?v=123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download Track" }));

    await waitFor(() => {
      expect(mockDownloadTrackAction).toHaveBeenCalledWith(
        "https://youtube.com/watch?v=123",
        undefined
      );
    });
    expect(onTracksUpdate).toHaveBeenCalledTimes(1);
  });

  it("uploads local file via signed url flow and calls onTracksUpdate", async () => {
    const onTracksUpdate = vi.fn();
    renderWithI18n(
      <DownloadTrack onTracksUpdate={onTracksUpdate} tracks={[]} />
    );

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            signedUrl: "https://storage.example.com/signed",
            trackId: "t-local-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["abc"], "local.mp3", { type: "audio/mpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
    expect(onTracksUpdate).toHaveBeenCalledTimes(1);
  });

  it("deletes track and calls onTracksUpdate", async () => {
    const onTracksUpdate = vi.fn();
    renderWithI18n(
      <DownloadTrack onTracksUpdate={onTracksUpdate} tracks={baseTracks} />
    );

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/tracks/p1", { method: "DELETE" });
    });
    expect(onTracksUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows debug details on network failure during download", async () => {
    mockDownloadTrackAction.mockRejectedValue(new Error("Failed to fetch"));
    renderWithI18n(<DownloadTrack onTracksUpdate={vi.fn()} tracks={[]} />);

    fireEvent.change(screen.getByLabelText("Track URL"), {
      target: { value: "https://youtube.com/watch?v=123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download Track" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
      expect(screen.getByText("Debug details")).toBeInTheDocument();
      expect(screen.getByText(/operation: download-track-action-threw/)).toBeInTheDocument();
      expect(screen.getByText(/online:/)).toBeInTheDocument();
    });
  });
});
