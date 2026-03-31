/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrackStatusBadge from "./TrackStatusBadge";
import { I18nProvider } from "../I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

const renderWithI18n = (ui: React.ReactNode) => {
  return render(
    <I18nProvider locale="en" messages={getMessages("en")}>
      {ui}
    </I18nProvider>
  );
};

describe("TrackStatusBadge", () => {
  it("renders status text for uploaded ftp", () => {
    renderWithI18n(<TrackStatusBadge status="uploaded_ftp" />);
    expect(screen.getByText("Uploaded via FTP")).toBeInTheDocument();
  });

  it("applies bg-success-100 for uploaded ftp", () => {
    const { container } = renderWithI18n(<TrackStatusBadge status="uploaded_ftp" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-success-100");
  });

  it("applies bg-blue-100 for downloaded", () => {
    const { container } = renderWithI18n(<TrackStatusBadge status="downloaded" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-blue-100");
  });

  it("applies bg-orange-100 for reviewed rejected", () => {
    const { container } = renderWithI18n(<TrackStatusBadge status="reviewed_rejected" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-orange-100");
  });

  it("applies bg-yellow-100 for downloading", () => {
    const { container } = renderWithI18n(<TrackStatusBadge status="downloading" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-yellow-100");
  });

  it("applies bg-red-100 for error", () => {
    const { container } = renderWithI18n(<TrackStatusBadge status="error" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-red-100");
  });
});
