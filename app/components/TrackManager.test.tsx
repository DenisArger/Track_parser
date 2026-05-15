// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider } from "./I18nProvider";
import TrackManager from "./TrackManager";
import { getMessages } from "@/lib/i18n/getMessages";

const mockCleanupTracksAction = vi.fn();
const mockCleanupUnusedStorageFilesAction = vi.fn();

vi.mock("@/lib/actions/trackActions", () => ({
  getTrackStatsAction: vi.fn(),
  cleanupTracksAction: (...args: unknown[]) => mockCleanupTracksAction(...args),
  cleanupUnusedStorageFilesAction: (...args: unknown[]) =>
    mockCleanupUnusedStorageFilesAction(...args),
  resetAllDataAction: vi.fn(),
}));

const renderWithI18n = (ui: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={getMessages("en")}>
      {ui}
    </I18nProvider>
  );

describe("TrackManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockCleanupTracksAction.mockResolvedValue({
      statsAfter: { total: 0, downloaded: 0, processed: 0, rejected: 0 },
    });
    mockCleanupUnusedStorageFilesAction.mockResolvedValue({
      cleaned: 3,
      byStatus: { uploaded_radio: 2, reviewed_rejected: 1 },
      previewsCleared: 5,
    });
  });

  it("shows cleanup uploaded_radio action for admins", async () => {
    renderWithI18n(<TrackManager />);

    fireEvent.click(screen.getByRole("button", { name: "Clean unused files" }));

    await waitFor(() => {
      expect(mockCleanupUnusedStorageFilesAction).toHaveBeenCalled();
      expect(
        screen.getByText(
          "Removed Storage files for 3 tracks, cleared 5 preview files. Breakdown: {\"uploaded_radio\":2,\"reviewed_rejected\":1}"
        )
      ).toBeInTheDocument();
    });
  });
});
