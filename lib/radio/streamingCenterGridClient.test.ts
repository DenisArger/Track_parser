import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDateRange,
  createGridEvent,
  deleteGridEvent,
  fetchGridEvents,
  updateGridEvent,
} from "./streamingCenterGridClient";

const mockFetch = vi.fn();

describe("streamingCenterGridClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("fetchGridEvents loads array payloads", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: "Morning" }]), {
        status: 200,
      })
    );

    const events = await fetchGridEvents("https://api.example.com/api/v2", "key", {
      server: 2,
      startTs: 10,
      endTs: 20,
      utc: 1,
    });

    expect(events).toEqual([{ id: 1, name: "Morning" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/v2/grid/?server=2&start_ts=10&end_ts=20&utc=1",
      { headers: { "SC-API-KEY": "key" } }
    );
  });

  it("createGridEvent posts payload and returns object", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 77, name: "Created" }), { status: 200 })
    );

    const event = await createGridEvent("https://api.example.com", "key", {
      server: 1,
      name: "Created",
      periodicity: "onetime",
      cast_type: "playlist",
      start_date: "2026-04-08",
      start_time: "08:00:00",
    });

    expect(event.id).toBe(77);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v2/grid/");
    expect(init.method).toBe("POST");
  });

  it("updateGridEvent sends PUT to item URL", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 9, name: "Updated" }), { status: 200 })
    );

    const event = await updateGridEvent("https://api.example.com", "key", 9, {
      server: 1,
      name: "Updated",
      periodicity: "onetime",
      cast_type: "playlist",
      start_date: "2026-04-08",
      start_time: "08:00:00",
    });

    expect(event.name).toBe("Updated");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v2/grid/9/");
    expect(init.method).toBe("PUT");
  });

  it("deleteGridEvent sends DELETE to item URL", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

    await deleteGridEvent("https://api.example.com", "key", 5);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v2/grid/5/");
    expect(init.method).toBe("DELETE");
  });

  it("buildDateRange returns unix timestamps", async () => {
    const range = buildDateRange("2026-04-08", 2);
    expect(range.endTs).toBeGreaterThan(range.startTs);
  });
});
