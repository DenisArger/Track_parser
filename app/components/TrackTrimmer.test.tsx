/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrackTrimmer from "./TrackTrimmer";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";
import type { WaveformTrimEditorProps } from "./WaveformTrimEditor";

const mockTrimTrackAction = vi.fn();
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
        <button type="button" onClick={() => props.onPlaybackStartChange?.(42)}>
          Waveform change playback start
        </button>
        <button type="button" onClick={() => props.onDurationLoaded?.(240)}>
          Waveform load duration
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

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
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
    expect(screen.getByDisplayValue("180")).toBeInTheDocument();
  });

  it("uses in-focus trim inputs for trim save", async () => {
    renderTrimmer();

    const startInput = screen.getByPlaceholderText("M:SS.ms");
    fireEvent.focus(startInput);
    fireEvent.change(startInput, { target: { value: "0:03.0" } });

    const fadeInInput = screen.getAllByRole("spinbutton")[1];
    fireEvent.change(fadeInInput, { target: { value: "1.5" } });

    fireEvent.click(screen.getByRole("button", { name: "Trim track" }));

    await waitFor(() => {
      expect(mockTrimTrackAction).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ startTime: 3, fadeIn: 1.5, maxDuration: 180 })
      );
    });
  });

  it("plays the track locally from the playback start line", async () => {
    renderTrimmer();
    const playSpy = vi.mocked(HTMLMediaElement.prototype.play);

    fireEvent.click(screen.getByRole("button", { name: "Waveform change playback start" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    const audio = screen.getByTestId("trim-preview-audio") as HTMLAudioElement;
    expect(audio.currentTime).toBe(42);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("stops playback when the track reaches the end", async () => {
    renderTrimmer();
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause);

    fireEvent.click(screen.getByRole("button", { name: "Waveform change playback start" }));

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    const audio = screen.getByTestId("trim-preview-audio") as HTMLAudioElement;
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 179.99,
    });
    fireEvent(audio, new Event("timeupdate"));

    expect(pauseSpy).toHaveBeenCalled();
    expect(audio.currentTime).toBe(42);
  });

  it("keeps playback independent from trim range changes", async () => {
    renderTrimmer();
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    const audio = screen.getByTestId("trim-preview-audio") as HTMLAudioElement;
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 5,
    });
    fireEvent(audio, new Event("play"));

    fireEvent.click(screen.getByRole("button", { name: "Waveform change start" }));

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(5);
  });

  it("resets trim range and fades", async () => {
    renderTrimmer();

    fireEvent.click(screen.getByRole("button", { name: "Waveform change start" }));
    fireEvent.click(screen.getByRole("button", { name: "Waveform change duration" }));

    const fadeInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(fadeInputs[1], { target: { value: "2" } });
    fireEvent.change(fadeInputs[2], { target: { value: "3" } });

    fireEvent.click(screen.getAllByRole("button", { name: "Reset" })[0]);

    expect(screen.getByPlaceholderText("M:SS.ms")).toHaveValue("0:00.00");
    expect(screen.getByDisplayValue("180")).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(0);
    expect(screen.getAllByRole("spinbutton")[2]).toHaveValue(0);
  });

  it("shows alerts for trim and playback errors", async () => {
    mockTrimTrackAction.mockRejectedValueOnce(new Error("trim fail"));
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("play fail")),
    });

    renderTrimmer();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Preview playback error");
    });

    fireEvent.click(screen.getByRole("button", { name: "Trim track" }));
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Trim error: trim fail");
    });

    const audio = screen.getByTestId("trim-preview-audio");
    fireEvent.error(audio);
    expect(mockAlert).toHaveBeenCalledWith(
      "Error loading audio file. Please check the console for details."
    );
  });
});
