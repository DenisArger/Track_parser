/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

describe("app error page", () => {
  it("renders digest and calls reset on click", () => {
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorPage
        error={Object.assign(new Error("boom"), { digest: "abc123" })}
        reset={reset}
      />
    );

    expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
    expect(screen.getByText("Error ID: abc123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
