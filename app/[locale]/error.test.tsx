/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocaleErrorPage from "./error";
import { I18nProvider } from "../components/I18nProvider";
import { getMessages } from "@/lib/i18n/getMessages";

describe("locale error page", () => {
  it("renders localized error and calls reset", () => {
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <I18nProvider locale="en" messages={getMessages("en")}>
        <LocaleErrorPage
          error={Object.assign(new Error("boom"), { digest: "id-42" })}
          reset={reset}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/Error ID/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
