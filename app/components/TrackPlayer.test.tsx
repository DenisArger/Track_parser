/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrackPlayer from "./TrackPlayer";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockProcessTrackAction = vi.fn();
const mockDeleteTrackAction = vi.fn();
const mockAlert = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  processTrackAction: (...args: unknown[]) => mockProcessTrackAction(...args),
  deleteTrackAction: (...args: unknown[]) => mockDeleteTrackAction(...args),
}));

vi.mock("./TrackTrimmer", () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div>
      <span>TrackTrimmerMock</span>
      <button onClick={onCancel}>Close trimmer</button>
    </div>
  ),
}));

vi.mock("./TrimDetails", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span>TrimDetailsMock</span>
      <button onClick={onClose}>Close details</button>
    </div>
  ),
}));

describe("TrackPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("alert", mockAlert);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockProcessTrackAction.mockResolvedValue({ ok: true });
    mockDeleteTrackAction.mockResolvedValue({ ok: true });
  });

  const tracks = [
    {
      id: "d1",
      filename: "d1.mp3",
      originalPath: "downloads/d1.mp3",
      status: "downloaded",
      metadata: {
        title: "Downloaded song",
        artist: "Artist A",
        album: "",
        genre: "Средний",
        rating: 5,
        year: 2025,
        duration: 120,
      },
    },
    {
      id: "t1",
      filename: "t1.mp3",
      originalPath: "downloads/t1.mp3",
      processedPath: "processed/t1.mp3",
      status: "trimmed",
      metadata: {
        title: "Trimmed song",
        artist: "Artist B",
        album: "",
        genre: "Быстрый",
        rating: 8,
        year: 2024,
        isTrimmed: true,
        trimSettings: {
          startTime: 10,
          endTime: 40,
          fadeIn: 0,
          fadeOut: 0,
        },
      },
    },
  ] as any;

  const renderPlayer = (onTracksUpdate = vi.fn()) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <TrackPlayer onTracksUpdate={onTracksUpdate} tracks={tracks} />
      </I18nProvider>
    );

  it("accepts downloaded track", async () => {
    const onTracksUpdate = vi.fn();
    renderPlayer(onTracksUpdate);

    fireEvent.click(screen.getByText("Downloaded song"));
    fireEvent.click(screen.getByRole("button", { name: "Accept Track" }));

    await waitFor(() => {
      expect(mockProcessTrackAction).toHaveBeenCalledWith(
        "d1",
        expect.objectContaining({ title: "Downloaded song" })
      );
    });
    expect(onTracksUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects track after confirmation", async () => {
    const onTracksUpdate = vi.fn();
    renderPlayer(onTracksUpdate);

    fireEvent.click(screen.getByText("Downloaded song"));
    fireEvent.click(screen.getByRole("button", { name: "Reject Track" }));

    await waitFor(() => {
      expect(mockDeleteTrackAction).toHaveBeenCalledWith("d1");
    });
    expect(onTracksUpdate).toHaveBeenCalled();
  });

  it("handles trimmed-track controls and modals", async () => {
    const onTracksUpdate = vi.fn();
    renderPlayer(onTracksUpdate);

    fireEvent.click(screen.getByText("Trimmed song"));

    expect(screen.getByText("Trimmed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("TrimDetailsMock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    await waitFor(() => {
      expect(screen.queryByText("TrimDetailsMock")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit trim" }));
    expect(screen.getByText("TrackTrimmerMock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close trimmer" }));
    await waitFor(() => {
      expect(onTracksUpdate).toHaveBeenCalled();
    });
  });

  it("shows alerts for audio, accept and reject errors", async () => {
    mockProcessTrackAction.mockRejectedValueOnce(new Error("process fail"));
    mockDeleteTrackAction.mockRejectedValueOnce(new Error("delete fail"));

    const { container } = renderPlayer();

    fireEvent.click(screen.getByText("Downloaded song"));

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    fireEvent.error(audio as Element);
    expect(mockAlert).toHaveBeenCalledWith(
      "Error loading audio file. Please check the console for details."
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept Track" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Error processing track: process fail");
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject Track" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Error rejecting track: delete fail");
    });
  });
});
