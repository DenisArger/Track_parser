import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockGetAuthUser = vi.fn();
const mockTestFtpConnectionAction = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

vi.mock("@/lib/actions/trackActions", () => ({
  testFtpConnectionAction: (...args: unknown[]) =>
    mockTestFtpConnectionAction(...args),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/test-ftp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/test-ftp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(jsonRequest({}) as never);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockTestFtpConnectionAction).not.toHaveBeenCalled();
  });

  it("returns 400 when host or user is missing", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });

    const res = await POST(jsonRequest({ host: "", user: "" }) as never);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Host and username are required",
    });
    expect(mockTestFtpConnectionAction).not.toHaveBeenCalled();
  });

  it("returns 200 on successful connection test", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockTestFtpConnectionAction.mockResolvedValue(undefined);

    const ftpConfig = { host: "ftp.example.com", user: "radio", password: "x" };
    const res = await POST(jsonRequest(ftpConfig) as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: "Connection successful",
    });
    expect(mockTestFtpConnectionAction).toHaveBeenCalledWith(ftpConfig);
  });

  it("returns 500 when action throws", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockTestFtpConnectionAction.mockRejectedValue(new Error("FTP timeout"));

    const res = await POST(
      jsonRequest({ host: "ftp.example.com", user: "radio" }) as never
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "FTP timeout" });
  });
});
