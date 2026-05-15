import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockGetAuthUser = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockIsAdminUser = vi.fn();
const mockListStorageInventory = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
}));

vi.mock("@/lib/storage/supabaseStorage", () => ({
  STORAGE_BUCKETS: {
    downloads: "downloads",
    processed: "processed",
    rejected: "rejected",
    previews: "previews",
    serverUpload: "server-upload",
  },
  listStorageInventory: (...args: unknown[]) => mockListStorageInventory(...args),
}));

describe("GET /api/storage/inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSupabaseServerClient.mockReturnValue({});
    mockIsAdminUser.mockResolvedValue(true);
  });

  it("returns 401 when user is missing", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockIsAdminUser.mockResolvedValue(false);

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns inventory and total files for admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1" });
    mockListStorageInventory.mockResolvedValue([
      { bucket: "downloads", count: 2, paths: ["a.mp3", "b.mp3"] },
      { bucket: "processed", count: 1, paths: ["c.mp3"] },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      buckets: [
        { bucket: "downloads", count: 2, paths: ["a.mp3", "b.mp3"] },
        { bucket: "processed", count: 1, paths: ["c.mp3"] },
      ],
      totalFiles: 3,
    });
  });
});
