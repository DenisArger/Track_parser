/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrackTrimmer from "./TrackTrimmer";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockTrimTrackAction = vi.fn();
const mockCreatePreviewAction = vi.fn();
const mockAlert = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  trimTrackAction: (...args: unknown[]) => mockTrimTrackAction(...args),
  createPreviewAction: (...args: unknown[]) => mockCreatePreviewAction(...args),
}));

vi.mock("./WaveformTrimEditor", () => ({
  default: () => <div>WaveformTrimEditorMock</div>,
}));

describe("TrackTrimmer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("alert", mockAlert);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });

    mockTrimTrackAction.mockResolvedValue({ ok: true });
    mockCreatePreviewAction.mockResolvedValue({ previewId: "p1" });
  });

  const track = {
    id: "t1",
    filename: "song.mp3",
    originalPath: "downloads/song.mp3",
    status: "downloaded",
    metadata: {
      title: "Song",
      artist: "Artist",
      album: "",
      genre: "Средний",
      rating: 5,
      year: 2025,
      duration: 180,
    },
  } as any;

  const renderTrimmer = (onCancel = vi.fn()) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <TrackTrimmer track={track} onCancel={onCancel} />
      </I18nProvider>
    );

  it("trims track and closes modal", async () => {
    const onCancel = vi.fn();
    renderTrimmer(onCancel);

    fireEvent.click(screen.getByRole("button", { name: "Trim track" }));

    await waitFor(() => {
      expect(mockTrimTrackAction).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ startTime: 0, maxDuration: 360 })
      );
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it("creates preview, updates it and supports seek/restart", async () => {
    renderTrimmer();

    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));

    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ startTime: 0, maxDuration: 360 })
      );
    });

    const audio = document.querySelector('audio[src="/api/preview-audio/p1"]') as HTMLAudioElement;
    expect(audio).not.toBeNull();

    Object.defineProperty(audio, "duration", { configurable: true, value: 42 });
    fireEvent.loadedMetadata(audio);
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 5 });
    fireEvent.timeUpdate(audio);

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "12" } });
    expect(audio.currentTime).toBe(12);

    fireEvent.click(screen.getByTitle("From start"));
    expect(audio.currentTime).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledTimes(2);
    });
  });

  it("shows alerts for trim/preview/playback errors", async () => {
    mockTrimTrackAction.mockRejectedValueOnce(new Error("trim fail"));
    mockCreatePreviewAction.mockRejectedValueOnce(new Error("preview fail"));

    renderTrimmer();

    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Preview error: preview fail");
    });

    fireEvent.click(screen.getByRole("button", { name: "Trim track" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Trim error: trim fail");
    });

    mockCreatePreviewAction.mockResolvedValueOnce({ previewId: "p2" });
    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));
    await waitFor(() => {
      expect(document.querySelector('audio[src="/api/preview-audio/p2"]')).not.toBeNull();
    });

    const audio = document.querySelector('audio[src="/api/preview-audio/p2"]') as HTMLAudioElement;
    fireEvent.error(audio);
    expect(mockAlert).toHaveBeenCalledWith("Preview playback error");
  });
});
