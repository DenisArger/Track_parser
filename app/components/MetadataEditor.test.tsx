/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MetadataEditor from "./MetadataEditor";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockUpdateMetadataAction = vi.fn();
const mockFetch = vi.fn();
const mockAlert = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  updateMetadataAction: (...args: unknown[]) => mockUpdateMetadataAction(...args),
}));

describe("MetadataEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("alert", mockAlert);

    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";

      if (url.includes("/api/radio/artists")) {
        return Promise.resolve(
          new Response(JSON.stringify({ artists: ["Alpha", "Beta"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      if (url.includes("/api/tracks/t1/status") && method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    mockUpdateMetadataAction.mockResolvedValue({ ok: true });
  });

  const tracks = [
    {
      id: "t1",
      filename: "a.mp3",
      originalPath: "downloads/a.mp3",
      processedPath: "processed/a.mp3",
      status: "processed",
      metadata: {
        title: "Old title",
        artist: "Artist",
        album: "Album",
        genre: "Средний",
        rating: 5,
        year: 2025,
        duration: 123,
      },
    },
    {
      id: "t2",
      filename: "b.mp3",
      originalPath: "downloads/b.mp3",
      status: "downloaded",
      metadata: {
        title: "Skip",
        artist: "Other",
        album: "",
        genre: "Быстрый",
        rating: 7,
        year: 2024,
      },
    },
  ] as any;

  const renderEditor = (onTracksUpdate = vi.fn()) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <MetadataEditor onTracksUpdate={onTracksUpdate} tracks={tracks} />
      </I18nProvider>
    );

  it("saves metadata for selected processed track", async () => {
    const onTracksUpdate = vi.fn();
    renderEditor(onTracksUpdate);

    fireEvent.click(screen.getByText("Old title"));

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "New title" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Metadata" }));

    await waitFor(() => {
      expect(mockUpdateMetadataAction).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ title: "New title" })
      );
    });
    expect(onTracksUpdate).toHaveBeenCalledTimes(1);
  });

  it("changes status and triggers refresh", async () => {
    const onTracksUpdate = vi.fn();
    renderEditor(onTracksUpdate);

    fireEvent.click(screen.getByText("Old title"));

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "trimmed" },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tracks/t1/status",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(onTracksUpdate).toHaveBeenCalled();
  });

  it("shows errors when save or status update fails", async () => {
    mockUpdateMetadataAction.mockRejectedValueOnce(new Error("save failed"));
    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";
      if (url.includes("/api/radio/artists")) {
        return Promise.resolve(
          new Response(JSON.stringify({ artists: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (url.includes("/api/tracks/t1/status") && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "forbidden" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    renderEditor();

    fireEvent.click(screen.getByText("Old title"));
    fireEvent.click(screen.getByRole("button", { name: "Save Metadata" }));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Error updating metadata: save failed");
    });

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "trimmed" },
    });

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        "Failed to change status: forbidden"
      );
    });
  });
});
