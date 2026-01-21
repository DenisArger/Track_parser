import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetAuthUser = vi.fn();
const mockLoadConfig = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/ftp-config", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.error).toBe("Unauthorized");
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it("returns 200 with ftp config when authenticated", async () => {
    mockGetAuthUser.mockResolvedValue({});
    mockLoadConfig.mockResolvedValue({
      ftp: {
        host: "ftp.example.com",
        port: 21,
        user: "u",
        password: "p",
        secure: false,
        remotePath: "/music",
      },
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.host).toBe("ftp.example.com");
    expect(j.port).toBe(21);
    expect(j.user).toBe("u");
    expect(j.password).toBe("p");
    expect(j.secure).toBe(false);
    expect(j.remotePath).toBe("/music");
  });

  it("returns empty remotePath when undefined in config", async () => {
    mockGetAuthUser.mockResolvedValue({});
    mockLoadConfig.mockResolvedValue({
      ftp: {
        host: "h",
        port: 21,
        user: "u",
        password: "p",
        secure: false,
      },
    });

    const res = await GET();
    const j = await res.json();
    expect(j.remotePath).toBe("");
  });

  it("returns 500 when loadConfig throws", async () => {
    mockGetAuthUser.mockResolvedValue({});
    mockLoadConfig.mockRejectedValue(new Error("read failed"));

    const res = await GET();

    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).toBe("Failed to load FTP configuration");
  });
});
