/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrimDetails from "./TrimDetails";
import { I18nProvider } from "./I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

describe("TrimDetails", () => {
  const renderWithI18n = (ui: React.ReactNode) =>
    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        {ui}
      </I18nProvider>
    );

  it("renders timings and fade values", () => {
    renderWithI18n(
      <TrimDetails
        trimSettings={{
          startTime: 30,
          endTime: 120,
          fadeIn: 5,
          fadeOut: 3,
          maxDuration: 90,
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Trim details")).toBeInTheDocument();
    expect(screen.getByText("0:30")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
    expect(screen.getByText("3s")).toBeInTheDocument();
  });

  it("uses start + maxDuration when endTime is missing and handles close", () => {
    const onClose = vi.fn();
    renderWithI18n(
      <TrimDetails
        trimSettings={{
          startTime: 10,
          fadeIn: 0,
          fadeOut: 0,
          maxDuration: 60,
        }}
        onClose={onClose}
      />
    );

    expect(screen.getByText("1:10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
