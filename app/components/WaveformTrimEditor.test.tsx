/** @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WaveformTrimEditor from "./WaveformTrimEditor";

type Region = {
  start: number;
  end: number;
  setOptions: ReturnType<typeof vi.fn>;
};

type RegionHandler = (region: Region) => void;

let mockDuration = 120;
let currentRegion: Region | null = null;
let handlers: Record<string, RegionHandler> = {};
const clearRegionsSpy = vi.fn();
const addRegionSpy = vi.fn();
const enableDragSelectionSpy = vi.fn(() => vi.fn());
const wsDestroySpy = vi.fn();
const wsLoadSpy = vi.fn(async () => {});

vi.mock("wavesurfer.js", () => ({
  default: {
    create: () => ({
      registerPlugin: vi.fn(),
      load: wsLoadSpy,
      getDuration: () => mockDuration,
      destroy: wsDestroySpy,
    }),
  },
}));

vi.mock("wavesurfer.js/dist/plugins/regions.esm.js", () => ({
  default: {
    create: () => ({
      clearRegions: (...args: unknown[]) => clearRegionsSpy(...args),
      addRegion: (opts: { start: number; end: number }) => {
        currentRegion = {
          start: opts.start,
          end: opts.end,
          setOptions: vi.fn((patch: { start?: number; end?: number }) => {
            currentRegion = {
              ...(currentRegion as Region),
              start: patch.start ?? (currentRegion as Region).start,
              end: patch.end ?? (currentRegion as Region).end,
            };
          }),
        };
        addRegionSpy(opts);
        return currentRegion;
      },
      getRegions: () => (currentRegion ? [currentRegion] : []),
      enableDragSelection: (...args: unknown[]) => enableDragSelectionSpy(...args),
      on: (event: string, cb: RegionHandler) => {
        handlers[event] = cb;
      },
    }),
  },
}));

describe("WaveformTrimEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    currentRegion = null;
    mockDuration = 120;
  });

  it("initializes waveform and handles region updates in end-time mode", async () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    const onMaxDurationChange = vi.fn();
    const onDurationLoaded = vi.fn();

    render(
      <WaveformTrimEditor
        audioUrl="/api/audio/t1"
        startTime={5}
        endTime={30}
        maxDuration={20}
        useEndTime={true}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
        onMaxDurationChange={onMaxDurationChange}
        onDurationLoaded={onDurationLoaded}
      />
    );

    await waitFor(() => {
      expect(wsLoadSpy).toHaveBeenCalledWith("/api/audio/t1");
    });
    expect(onDurationLoaded).toHaveBeenCalledWith(120);

    handlers["region-created"]({
      start: 8,
      end: 16,
      setOptions: vi.fn(),
    });

    expect(onStartChange).toHaveBeenCalledWith(8);
    expect(onEndChange).toHaveBeenCalledWith(16);
    expect(onMaxDurationChange).not.toHaveBeenCalled();
  });

  it("syncs parent values into region and updates maxDuration when not using end-time", async () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    const onMaxDurationChange = vi.fn();

    const { rerender } = render(
      <WaveformTrimEditor
        audioUrl="/api/audio/t2"
        startTime={1}
        endTime={undefined}
        maxDuration={10}
        useEndTime={false}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
        onMaxDurationChange={onMaxDurationChange}
      />
    );

    await waitFor(() => {
      expect(currentRegion).not.toBeNull();
    });

    handlers["region-updated"]({
      start: 12,
      end: 25,
      setOptions: vi.fn(),
    });

    expect(onStartChange).toHaveBeenCalledWith(12);
    expect(onMaxDurationChange).toHaveBeenCalledWith(13);

    rerender(
      <WaveformTrimEditor
        audioUrl="/api/audio/t2"
        startTime={20}
        endTime={undefined}
        maxDuration={15}
        useEndTime={false}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
        onMaxDurationChange={onMaxDurationChange}
      />
    );

    await waitFor(() => {
      expect((currentRegion as Region).setOptions).toHaveBeenCalledWith({
        start: 20,
        end: 35,
      });
    });
  });
});
