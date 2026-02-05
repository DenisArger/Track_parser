/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TrackList from "./TrackList";
import type { Track } from "@/types/track";
import { I18nProvider } from "../I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const renderWithI18n = (ui: React.ReactNode) => {
  return render(
    <I18nProvider locale="en" messages={getMessages("en")}>
      {ui}
    </I18nProvider>
  );
};

function mkTrack(
  id: string,
  overrides?: Partial<Track>
): Track {
  return {
    id,
    filename: `${id}.mp3`,
    originalPath: `/x/${id}.mp3`,
    metadata: {
      title: `Title ${id}`,
      artist: `Artist ${id}`,
      album: "Album",
      genre: "Средний",
      rating: 5,
      year: 2024,
      duration: 120,
    },
    status: "downloaded",
    ...overrides,
  };
}

describe("TrackList", () => {
  it("shows emptyMessage when tracks is empty", () => {
    renderWithI18n(<TrackList tracks={[]} emptyMessage="No tracks" />);
    expect(screen.getByText("No tracks")).toBeInTheDocument();
  });

  it("shows emptySubMessage when provided and empty", () => {
    renderWithI18n(
      <TrackList
        tracks={[]}
        emptyMessage="Empty"
        emptySubMessage="Add some"
      />
    );
    expect(screen.getByText("Add some")).toBeInTheDocument();
  });

  it("renders track title and artist", () => {
    const tracks = [mkTrack("1")];
    renderWithI18n(<TrackList tracks={tracks} />);
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    expect(screen.getByText("Artist 1")).toBeInTheDocument();
  });

  it("shows TrackStatusBadge when showStatus is true", () => {
    const tracks = [mkTrack("1", { status: "uploaded" })];
    renderWithI18n(<TrackList tracks={tracks} showStatus />);
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it("shows duration when showDuration is true", () => {
    const tracks = [mkTrack("1")];
    renderWithI18n(<TrackList tracks={tracks} showDuration />);
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("calls onTrackSelect when a track is clicked", () => {
    const tracks = [mkTrack("1")];
    const onTrackSelect = vi.fn();
    renderWithI18n(<TrackList tracks={tracks} onTrackSelect={onTrackSelect} />);
    fireEvent.click(screen.getByText("Title 1"));
    expect(onTrackSelect).toHaveBeenCalledWith(tracks[0]);
  });

  it("applies selected styles when selectedTrackId matches", () => {
    const tracks = [mkTrack("1"), mkTrack("2")];
    const { container } = renderWithI18n(
      <TrackList tracks={tracks} selectedTrackId="1" />
    );
    const rows = container.querySelectorAll(".border-primary-500");
    expect(rows.length).toBe(1);
  });
});
