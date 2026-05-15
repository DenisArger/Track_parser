"use client";

import { useEffect, useMemo } from "react";
import { useI18n } from "../components/I18nProvider";
import ErrorNotice from "../components/ErrorNotice";
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
  const { t } = useI18n();

  const report = useMemo(
    () =>
      buildErrorReport(error, {
        operation: "route-error",
        component: "localized-error-page",
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
      title={t("errorPage.title")}
      description={t("errorPage.subtitle")}
      hint={t("errorPage.reportHint")}
      errorId={`${t("errorPage.errorId")}: ${report.digest}`}
      details={reportDetails}
      onReset={reset}
      resetLabel={t("errorPage.tryAgain")}
      copyLabel={t("errorPage.copyDetails")}
      copySuccessLabel={t("errorPage.copySuccess")}
      copyErrorLabel={t("errorPage.copyFailed")}
    />
  );
}
