/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrackStatusBadge from "./TrackStatusBadge";

describe("TrackStatusBadge", () => {
  it("renders status text for uploaded", () => {
    render(<TrackStatusBadge status="uploaded" />);
    expect(screen.getByText("uploaded")).toBeInTheDocument();
  });

  it("applies bg-success-100 for uploaded", () => {
    const { container } = render(<TrackStatusBadge status="uploaded" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-success-100");
  });

  it("applies bg-blue-100 for downloaded", () => {
    const { container } = render(<TrackStatusBadge status="downloaded" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-blue-100");
  });

  it("applies bg-danger-100 for rejected", () => {
    const { container } = render(<TrackStatusBadge status="rejected" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-danger-100");
  });

  it("applies bg-yellow-100 for downloading", () => {
    const { container } = render(<TrackStatusBadge status="downloading" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-yellow-100");
  });

  it("applies bg-red-100 for error", () => {
    const { container } = render(<TrackStatusBadge status="error" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-red-100");
  });
});
