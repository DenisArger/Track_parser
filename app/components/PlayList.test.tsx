/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlayList from "./PlayList";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockFetch = vi.fn();

function renderWithI18n() {
  return render(
    <I18nProvider locale="en" messages={getMessages("en")}>
      <PlayList onTracksUpdate={vi.fn()} />
    </I18nProvider>
  );
}

describe("PlayList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();

    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";

      if (url.includes("/api/radio/playlist-tracks")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              tracks: [
                {
                  id: "t1",
                  raw_name: "a.mp3",
                  artist: "Alpha",
                  title: "Song A",
                  track_type: "Быстрый",
                  year: 2024,
                  rating: 10,
                  created_at: "2026-02-10T12:00:00.000Z",
                },
                {
                  id: "t2",
                  raw_name: "b.mp3",
                  artist: "Beta",
                  title: "Song B",
                  track_type: "Средний",
                  year: 2021,
                  rating: 7,
                  created_at: "2026-02-11T12:00:00.000Z",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (url.includes("/api/playlist/related-groups") && method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ groups: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      if (url.includes("/api/playlist/rotation-template") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              template: [
                {
                  id: "row-1",
                  trackType: "Быстрый",
                  ageGroup: "new",
                  count: 1,
                  useGlobalLimits: true,
                },
              ],
              settings: {
                targetHours: 0,
                targetMinutes: 0,
                avgMinutes: 3,
                avgSeconds: 30,
                minArtistGapMinutes: 0,
                minTrackGapMinutes: 0,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      if (url.includes("/api/playlist/rotation-template") && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      if (url.includes("/api/playlist/related-groups") && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      if (url.includes("/api/radio/upload-playlist")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: `Unhandled route: ${url}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });

  it("loads data and shows available stats", async () => {
    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByText("Playlist")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Total tracks: 2, old: 1, new: 1")
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith("/api/radio/playlist-tracks");
  });

  it("generates list, exports M3U and uploads playlist", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const createUrlSpy = vi.fn(() => "blob:playlist");
    const revokeSpy = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = createUrlSpy;
        static revokeObjectURL = revokeSpy;
      }
    );
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(screen.getByText(/Fast \(new\)/)).toBeInTheDocument();
      expect(screen.getByText(/Alpha - Song A/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Export M3U" }));
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:playlist");

    fireEvent.click(screen.getByRole("button", { name: "Upload to radio" }));

    await waitFor(() => {
      expect(screen.getByText("Playlist sent to radio")).toBeInTheDocument();
    });

    randomSpy.mockRestore();
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it("saves related groups and template", async () => {
    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add group" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add group" }));
    fireEvent.change(screen.getByPlaceholderText("Group name"), {
      target: { value: "A-team" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Groups saved")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => {
      expect(screen.getByText('Template "default" saved')).toBeInTheDocument();
    });
  });

  it("shows upload error when generated rows have no tracks", async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";

      if (url.includes("/api/radio/playlist-tracks")) {
        return Promise.resolve(
          new Response(JSON.stringify({ tracks: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (url.includes("/api/playlist/related-groups") && method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ groups: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (url.includes("/api/playlist/rotation-template") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              template: [
                {
                  id: "row-1",
                  trackType: "Быстрый",
                  ageGroup: "new",
                  count: 1,
                  useGlobalLimits: true,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => {
      expect(screen.getByText("No matching tracks")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Upload to radio" }));
    await waitFor(() => {
      expect(screen.getByText("No tracks to upload")).toBeInTheDocument();
    });
  });
});
