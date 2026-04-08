import { describe, it, expect } from "vitest";
import {
  filterTracksByStatus,
  filterTracksByStatuses,
  getDownloadedTracks,
  getProcessedTracks,
  getUploadedTracks,
  getDownloadingTracks,
} from "./trackFilters";
import { Track } from "@/types/track";

function mkTrack(id: string, status: Track["status"]): Track {
  return {
    id,
    filename: `${id}.mp3`,
    originalPath: `/x/${id}.mp3`,
    metadata: {
      title: "T",
      artist: "A",
      album: "B",
      genre: "Средний",
      rating: 5,
      year: 2024,
    },
    status,
  };
}

describe("filterTracksByStatus", () => {
  it("filters by single status", () => {
    const tracks = [
      mkTrack("1", "downloaded"),
      mkTrack("2", "reviewed_approved"),
      mkTrack("3", "downloaded"),
    ];
    expect(filterTracksByStatus(tracks, "downloaded")).toEqual([
      tracks[0],
      tracks[2],
    ]);
  });
});

describe("filterTracksByStatuses", () => {
  it("filters by multiple statuses", () => {
    const tracks = [
      mkTrack("1", "downloaded"),
      mkTrack("2", "reviewed_approved"),
      mkTrack("3", "ready_for_upload"),
      mkTrack("4", "uploaded_ftp"),
      mkTrack("5", "reviewed_rejected"),
    ];
    const r = filterTracksByStatuses(tracks, ["reviewed_approved", "ready_for_upload"]);
    expect(r).toEqual([tracks[1], tracks[2]]);
  });
});

describe("getDownloadedTracks", () => {
  it("returns only downloaded", () => {
    const tracks = [
      mkTrack("1", "downloaded"),
      mkTrack("2", "processing"),
      mkTrack("3", "downloaded"),
    ];
    expect(getDownloadedTracks(tracks)).toEqual([tracks[0], tracks[2]]);
  });
});

describe("getProcessedTracks", () => {
  it("returns processed and radio-synced tracks", () => {
    const tracks = [
      mkTrack("1", "downloaded"),
      mkTrack("2", "reviewed_approved"),
      mkTrack("3", "ready_for_upload"),
      mkTrack("4", "uploaded_ftp"),
      mkTrack("5", "uploaded_radio"),
    ];
    expect(getProcessedTracks(tracks)).toEqual([tracks[1], tracks[2], tracks[4]]);
  });
});

describe("getUploadedTracks", () => {
  it("returns only uploaded", () => {
    const tracks = [
      mkTrack("1", "reviewed_approved"),
      mkTrack("2", "uploaded_ftp"),
    ];
    expect(getUploadedTracks(tracks)).toEqual([tracks[1]]);
  });
});

describe("getDownloadingTracks", () => {
  it("returns only downloading", () => {
    const tracks = [
      mkTrack("1", "downloading"),
      mkTrack("2", "downloaded"),
    ];
    expect(getDownloadingTracks(tracks)).toEqual([tracks[0]]);
  });
});
