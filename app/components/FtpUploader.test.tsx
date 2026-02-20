/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FtpUploader from "./FtpUploader";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockGetUserFacingErrorMessage = vi.fn(
  (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
);
const mockGetUploadedTracks = vi.fn();
const mockFetch = vi.fn();
const mockAlert = vi.fn();

vi.mock("@/lib/utils/errorMessage", () => ({
  getUserFacingErrorMessage: (...args: unknown[]) =>
    mockGetUserFacingErrorMessage(...args),
}));

vi.mock("@/lib/utils/trackFilters", () => ({
  getUploadedTracks: (...args: unknown[]) => mockGetUploadedTracks(...args),
}));

describe("FtpUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("alert", mockAlert);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockGetUploadedTracks.mockImplementation((tracks: any[]) =>
      tracks.filter((t) => t.status === "uploaded")
    );
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          host: "ftp.example.com",
          port: 21,
          user: "radio",
          password: "secret",
          secure: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    localStorage.clear();
  });

  const renderWithI18n = (ui: React.ReactNode) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        {ui}
      </I18nProvider>
    );

  const tracks = [
    {
      id: "p1",
      filename: "a.mp3",
      status: "processed",
      processedPath: "p1/a.mp3",
      metadata: { title: "Processed 1", artist: "A" },
    },
    {
      id: "u1",
      filename: "u.mp3",
      status: "uploaded",
      processedPath: "u1/u.mp3",
      metadata: { title: "Uploaded 1", artist: "B" },
    },
  ] as any;

  it("renders empty upload state when no processed tracks", async () => {
    renderWithI18n(<FtpUploader onTracksUpdate={vi.fn()} tracks={[]} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/ftp-config");
    });
    expect(
      screen.getByText("No processed tracks available for upload")
    ).toBeInTheDocument();
  });

  it("tests connection successfully", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            host: "ftp.example.com",
            port: 21,
            user: "radio",
            password: "secret",
            secure: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    renderWithI18n(<FtpUploader onTracksUpdate={vi.fn()} tracks={tracks} />);

    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("FTP connection successful!");
    });
  });

  it("uploads a single track and calls onTracksUpdate", async () => {
    const onTracksUpdate = vi.fn();
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            host: "ftp.example.com",
            port: 21,
            user: "radio",
            password: "secret",
            secure: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    renderWithI18n(<FtpUploader onTracksUpdate={onTracksUpdate} tracks={tracks} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Upload" })[0]);
    await waitFor(() => {
      expect(onTracksUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("shows per-track error during upload all when one upload fails", async () => {
    const uploadAllTracks = [
      {
        id: "p1",
        filename: "a.mp3",
        status: "processed",
        processedPath: "p1/a.mp3",
        metadata: { title: "Processed 1", artist: "A" },
      },
      {
        id: "p2",
        filename: "b.mp3",
        status: "trimmed",
        processedPath: "p2/b.mp3",
        metadata: { title: "Processed 2", artist: "B" },
      },
    ] as any;

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            host: "ftp.example.com",
            port: 21,
            user: "radio",
            password: "secret",
            secure: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "disk full" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    renderWithI18n(
      <FtpUploader onTracksUpdate={vi.fn()} tracks={uploadAllTracks} />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Upload All Tracks (2)" })
      ).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload All Tracks (2)" }));
    await waitFor(() => {
      expect(screen.getByText(/Failed to upload/)).toBeInTheDocument();
    });
  });
});
