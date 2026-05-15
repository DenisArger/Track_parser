import { describe, expect, it, vi } from "vitest";
import {
  buildErrorReport,
  formatErrorReportForCopy,
  logClientError,
  logServerError,
  reportClientError,
} from "./errorReporter";

describe("errorReporter", () => {
  it("builds a structured report from an Error", () => {
    const report = buildErrorReport(new Error("boom"), {
      operation: "test-operation",
      component: "test-component",
    });

    expect(report.errorName).toBe("Error");
    expect(report.errorMessage).toBe("boom");
    expect(report.meta.operation).toBe("test-operation");
    expect(report.meta.component).toBe("test-component");
    expect(report.digest).toBeDefined();
  });

  it("formats a report for copy with metadata and stack", () => {
    const report = buildErrorReport(new Error("boom"), {
      operation: "test-operation",
      endpoint: "/api/test",
    });
    const formatted = formatErrorReportForCopy(report);

    expect(formatted).toContain("Error ID:");
    expect(formatted).toContain("Name: Error");
    expect(formatted).toContain("Message: boom");
    expect(formatted).toContain("Context:");
    expect(formatted).toContain("endpoint");
  });

  it("logs client and server errors using console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = buildErrorReport(new Error("boom"));

    logClientError(report);
    logServerError(report);

    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("builds and logs a client error report", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = reportClientError(new Error("boom"), {
      operation: "client-op",
      component: "test",
    });

    expect(report.errorName).toBe("Error");
    expect(report.meta.operation).toBe("client-op");
    expect(report.meta.component).toBe("test");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
