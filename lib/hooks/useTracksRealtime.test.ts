/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrackRealtime, useTracksRealtime } from "./useTracksRealtime";

const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

let capturedChangeHandler:
  | ((payload: Record<string, any>) => void)
  | undefined;
let capturedStatusHandler: ((status: string) => void) | undefined;
const fakeChannelObject = {
  on: vi.fn((_type: string, _filter: unknown, handler: (payload: any) => void) => {
    capturedChangeHandler = handler;
    return fakeChannelObject;
  }),
  subscribe: vi.fn((handler: (status: string) => void) => {
    capturedStatusHandler = handler;
    return fakeChannelObject;
  }),
};

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

describe("useTracksRealtime hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedChangeHandler = undefined;
    capturedStatusHandler = undefined;
    mockChannel.mockReturnValue(fakeChannelObject);
  });

  it("useTracksRealtime subscribes to tracks channel and reflects connection status", () => {
    const { result, unmount } = renderHook(() => useTracksRealtime());

    expect(result.current.isConnected).toBe(false);
    expect(mockChannel).toHaveBeenCalledWith("tracks-changes");

    act(() => {
      capturedStatusHandler?.("SUBSCRIBED");
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      capturedStatusHandler?.("CLOSED");
    });
    expect(result.current.isConnected).toBe(false);

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(fakeChannelObject);
  });

  it("useTracksRealtime dispatches mapped track/update/insert/delete callbacks", () => {
    const onUpdate = vi.fn();
    const onInsert = vi.fn();
    const onDelete = vi.fn();

    renderHook(() => useTracksRealtime(onUpdate, onInsert, onDelete));

    const row = {
      id: "t1",
      filename: "Song.mp3",
      original_path: "downloads/t1/Song.mp3",
      processed_path: "processed/t1/Song.mp3",
      metadata: { title: "Song", genre: "Средний", rating: 5, year: 2026 },
      status: "processed",
      download_progress: 10,
      processing_progress: 20,
      upload_progress: 30,
      error: "",
    };

    act(() => {
      capturedChangeHandler?.({ eventType: "UPDATE", new: row });
      capturedChangeHandler?.({ eventType: "INSERT", new: row });
      capturedChangeHandler?.({ eventType: "DELETE", old: { id: "t-del" } });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "t1",
        originalPath: "downloads/t1/Song.mp3",
        processedPath: "processed/t1/Song.mp3",
        status: "processed",
        metadata: expect.objectContaining({ title: "Song", rating: 5, year: 2026 }),
      })
    );
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("t-del");
  });

  it("useTrackRealtime skips subscription when trackId is empty", () => {
    const { result } = renderHook(() => useTrackRealtime(""));

    expect(mockChannel).not.toHaveBeenCalled();
    expect(result.current.track).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it("useTrackRealtime subscribes by id and updates track from UPDATE payload", () => {
    const onUpdate = vi.fn();
    const { result, unmount } = renderHook(() => useTrackRealtime("id-1", onUpdate));

    expect(mockChannel).toHaveBeenCalledWith("track-id-1");
    expect(fakeChannelObject.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        schema: "public",
        table: "tracks",
        filter: "id=eq.id-1",
      }),
      expect.any(Function)
    );

    act(() => {
      capturedStatusHandler?.("SUBSCRIBED");
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      capturedChangeHandler?.({
        new: {
          id: "id-1",
          filename: "Track.mp3",
          original_path: "downloads/id-1/Track.mp3",
          metadata: { title: "Track", artist: "Artist" },
          status: "downloaded",
        },
      });
    });

    expect(result.current.track).toEqual(
      expect.objectContaining({
        id: "id-1",
        filename: "Track.mp3",
        status: "downloaded",
        metadata: expect.objectContaining({ title: "Track", artist: "Artist" }),
      })
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(fakeChannelObject);
  });
});
