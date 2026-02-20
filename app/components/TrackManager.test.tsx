/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrackManager from "./TrackManager";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const mockGetTrackStatsAction = vi.fn();
const mockCleanupTracksAction = vi.fn();
const mockResetAllDataAction = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  getTrackStatsAction: (...args: unknown[]) => mockGetTrackStatsAction(...args),
  cleanupTracksAction: (...args: unknown[]) => mockCleanupTracksAction(...args),
  resetAllDataAction: (...args: unknown[]) => mockResetAllDataAction(...args),
}));

describe("TrackManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const renderManager = (onTracksUpdate?: () => void) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <TrackManager onTracksUpdate={onTracksUpdate} />
      </I18nProvider>
    );

  it("loads stats and renders them", async () => {
    mockGetTrackStatsAction.mockResolvedValue({
      total: 10,
      downloaded: 3,
      processed: 4,
      trimmed: 2,
      rejected: 1,
    });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Load stats" }));

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
    expect(screen.getByText("Stats loaded")).toBeInTheDocument();
  });

  it("handles cleanup success", async () => {
    mockCleanupTracksAction.mockResolvedValue({
      statsAfter: {
        total: 8,
        downloaded: 2,
        processed: 3,
        trimmed: 2,
        rejected: 1,
      },
    });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Clean statuses" }));

    await waitFor(() => {
      expect(screen.getByText("Track statuses cleaned successfully")).toBeInTheDocument();
    });
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("resets data and calls onTracksUpdate on success", async () => {
    const onTracksUpdate = vi.fn();
    mockResetAllDataAction.mockResolvedValue({
      ok: true,
      deleted: 12,
      cleared: { downloads: 12, processed: 10, rejected: 2, previews: 1 },
    });
    renderManager(onTracksUpdate);

    fireEvent.click(screen.getByRole("button", { name: "Reset everything" }));

    await waitFor(() => {
      expect(screen.getByText(/Done: deleted 12 tracks/)).toBeInTheDocument();
    });
    expect(onTracksUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows reset error when action fails", async () => {
    mockResetAllDataAction.mockResolvedValue({ ok: false, error: "forbidden" });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Reset everything" }));

    await waitFor(() => {
      expect(screen.getByText("Error: forbidden")).toBeInTheDocument();
    });
  });
});
