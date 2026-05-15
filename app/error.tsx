"use client";

import { useEffect, useMemo } from "react";
import ErrorNotice from "./components/ErrorNotice";
import {
  buildErrorReport,
  formatErrorReportForCopy,
  logClientError,
} from "@/lib/utils/errorReporter";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const report = useMemo(
    () =>
      buildErrorReport(error, {
        operation: "route-error",
        component: "app-error-page",
      }),
    [error],
  );

  const reportDetails = useMemo(
    () => formatErrorReportForCopy(report),
    [report],
  );

  useEffect(() => {
    logClientError(report);
  }, [report]);

  return (
    <ErrorNotice
      title="Something went wrong!"
      description="An error occurred while rendering the page. Please try again."
      hint="Copy the details below and send them to the developer."
      errorId={`Error ID: ${report.digest}`}
      details={reportDetails}
      onReset={reset}
      resetLabel="Try again"
      copyLabel="Copy error details"
      copySuccessLabel="Copied"
      copyErrorLabel="Unable to copy. Please copy manually."
    />
  );
}
