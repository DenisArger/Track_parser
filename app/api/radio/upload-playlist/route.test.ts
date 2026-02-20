import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockGenerateSafeFilename = vi.fn();
const mockIconvEncode = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/utils/filenameUtils", () => ({
  generateSafeFilename: (...args: unknown[]) => mockGenerateSafeFilename(...args),
}));

vi.mock("iconv-lite", () => ({
  default: {
    encode: (...args: unknown[]) => mockIconvEncode(...args),
  },
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/radio/upload-playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/radio/upload-playlist", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockFetch);
    process.env = { ...originalEnv };
    process.env.STREAMING_CENTER_API_URL = "https://sc.example.com/api/v2";
    process.env.STREAMING_CENTER_API_KEY = "secret";
    process.env.STREAMING_CENTER_UPLOAD_TIMEOUT_MS = "4000";
    mockGenerateSafeFilename.mockReturnValue("generated-track");
    mockIconvEncode.mockImplementation((value: string) => Buffer.from(value));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({}));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "user@example.com" });

    const res = await POST(jsonRequest({}));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when playlist name is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });

    const res = await POST(jsonRequest({ tracks: [{ raw_name: "a.mp3" }] }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Название плейлиста обязательно",
    });
  });

  it("returns 400 when tracks are empty", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });

    const res = await POST(jsonRequest({ name: "test", tracks: [] }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Нет треков для загрузки" });
  });

  it("returns 500 when api env is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    delete process.env.STREAMING_CENTER_API_URL;

    const res = await POST(
      jsonRequest({
        name: "test",
        tracks: [{ raw_name: "a.mp3" }],
      })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы",
    });
  });

  it("returns 502 when fetch throws a timeout-like error", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockFetch.mockRejectedValue(new Error("timeout while connecting"));

    const res = await POST(
      jsonRequest({
        name: "test",
        tracks: [{ raw_name: "a.mp3" }],
      })
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Не удалось подключиться к Streaming.Center");
    expect(body.error).toContain("Timeout after 4000ms");
  });

  it("returns 502 when streaming.center responds with error", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "invalid payload" }), {
        status: 400,
        statusText: "Bad Request",
        headers: { "content-type": "application/json" },
      })
    );

    const res = await POST(
      jsonRequest({
        name: "test",
        tracks: [{ raw_name: "a.mp3" }],
      })
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "invalid payload" });
  });

  it("uploads playlist and returns payload on success", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "Den.Arger@gmail.com" });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 55, name: "Evening Set" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );

    const res = await POST(
      jsonRequest({
        name: "Evening Set",
        serverId: 2,
        isRandom: true,
        basePath: "D:\\Radio",
        tracks: [
          {
            raw_name: "C:\\Music\\Artist - Song.mp3",
            artist: "Artist",
            title: "Song",
          },
          {
            raw_name: "",
            artist: "NoRaw",
            title: "Track",
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      playlist: { id: 55, name: "Evening Set" },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sc.example.com/api/v2/playlists/");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "SC-API-KEY": "secret" });

    const form = init.body as FormData;
    expect(form.get("name")).toBe("Evening Set");
    expect(form.get("is_random")).toBe("True");
    expect(form.get("server")).toBe("2");

    const m3uBlob = form.get("m3u") as Blob;
    const text = await m3uBlob.text();
    expect(text).toContain("#EXTM3U");
    expect(text).toContain("#EXTINF:-1,Artist - Song");
    expect(text).toContain("D:\\Radio\\Artist - Song.mp3");
    expect(text).toContain("#EXTINF:-1,NoRaw - Track");
    expect(text).toContain("D:\\Radio\\generated-track.mp3");
  });

  it("encodes m3u using windows-1251 when useWindows1251=true", async () => {
    mockGetAuthUser.mockResolvedValue({ email: "den.arger@gmail.com" });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );

    await POST(
      jsonRequest({
        name: "Encoded",
        useWindows1251: true,
        tracks: [{ raw_name: "a.mp3" }],
      })
    );

    expect(mockIconvEncode).toHaveBeenCalledWith(expect.any(String), "windows-1251");
  });
});
