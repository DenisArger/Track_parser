/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrackTrimmer from "./TrackTrimmer";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";
import type { WaveformTrimEditorProps } from "./WaveformTrimEditor";

const mockTrimTrackAction = vi.fn();
const mockCreatePreviewAction = vi.fn();
const mockAlert = vi.fn();

type TrimmerTrack = {
  id: string;
  filename: string;
  originalPath: string;
  status: string;
  metadata: Record<string, unknown>;
};

vi.mock("@/lib/actions/trackActions", () => ({
  trimTrackAction: (...args: unknown[]) => mockTrimTrackAction(...args),
  createPreviewAction: (...args: unknown[]) => mockCreatePreviewAction(...args),
}));

let waveformProps: WaveformTrimEditorProps | null = null;

vi.mock("./WaveformTrimEditor", () => ({
  default: (props: WaveformTrimEditorProps) => {
    waveformProps = props;
    return (
      <div>
        <button type="button" onClick={() => props.onStartChange(15)}>
          Waveform change start
        </button>
        <button type="button" onClick={() => props.onMaxDurationChange(30)}>
          Waveform change duration
        </button>
        <button type="button" onClick={() => props.onEndChange(45)}>
          Waveform change end
        </button>
      </div>
    );
  },
}));

describe("TrackTrimmer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waveformProps = null;
    vi.stubGlobal("alert", mockAlert);

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
  } as TrimmerTrack;

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
        expect.objectContaining({ startTime: 0, maxDuration: 180 })
      );
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it("uses track metadata duration as the initial trim length", async () => {
    renderTrimmer();

    expect(screen.getByDisplayValue(180)).toBeInTheDocument();
  });

  it("creates preview without autoplay and renders native audio controls", async () => {
    renderTrimmer();

    const previewButton = screen.getByRole("button", { name: "Preview listen" });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ startTime: 0, maxDuration: 180 })
      );
    });

    const audio = document.querySelector('audio[src="/api/preview-audio/p1"]') as HTMLAudioElement;
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute("controls");

    fireEvent.click(screen.getByRole("button", { name: "Waveform change duration" }));
    await waitFor(() => {
      expect(screen.getByText("Preview needs updating")).toBeInTheDocument();
    });
    expect(mockCreatePreviewAction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));
    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByText("Preview needs updating")).not.toBeInTheDocument();
    });
  });

  it("does not auto-refresh preview after waveform changes and re-enables playback after manual refresh", async () => {
    renderTrimmer();

    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));

    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledTimes(1);
    });
    expect(waveformProps).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Waveform change start" }));

    await waitFor(() => {
      expect(screen.getByText("Preview needs updating")).toBeInTheDocument();
    });
    expect(mockCreatePreviewAction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));

    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByText("Preview needs updating")).not.toBeInTheDocument();
    });
  });

  it("does not autoplay preview after generation", async () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: playSpy,
    });

    renderTrimmer();

    fireEvent.click(screen.getByRole("button", { name: "Preview listen" }));

    await waitFor(() => {
      expect(mockCreatePreviewAction).toHaveBeenCalledTimes(1);
    });
    expect(playSpy).not.toHaveBeenCalled();
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
