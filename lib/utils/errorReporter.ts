export type ErrorReportMeta = {
  timestamp?: string;
  operation?: string;
  component?: string;
  endpoint?: string;
  statusCode?: number;
  stage?: string;
  userAgent?: string;
  url?: string;
  locale?: string;
  [key: string]: unknown;
};

export type ErrorReport = {
  digest: string;
  errorName: string;
  errorMessage: string;
  stack?: string;
  meta: ErrorReportMeta;
};

const getErrorDigest = (error: unknown): string => {
  const maybeDigest =
    typeof error === "object" && error !== null && "digest" in error
      ? (error as { digest?: unknown }).digest
      : undefined;

  if (typeof maybeDigest === "string" && maybeDigest.trim().length > 0) {
    return maybeDigest;
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export function buildErrorReport(
  error: unknown,
  meta: Partial<ErrorReportMeta> = {},
): ErrorReport {
  const errorName =
    error instanceof Error
      ? error.name
      : typeof error === "string"
        ? "Error"
        : typeof error === "object" && error !== null
          ? ((error as Record<string, unknown>).constructor?.name ?? "Error")
          : "Error";

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null
          ? JSON.stringify(error, null, 2)
          : "Unknown error";

  const stack = error instanceof Error && error.stack ? error.stack : undefined;
  const digest = getErrorDigest(error);
  const timestamp = meta.timestamp ?? new Date().toISOString();

  return {
    digest,
    errorName,
    errorMessage,
    stack,
    meta: {
      timestamp,
      ...meta,
    },
  };
}

export function formatErrorReportForCopy(report: ErrorReport): string {
  const lines: string[] = [
    `Error ID: ${report.digest}`,
    `Name: ${report.errorName}`,
    `Message: ${report.errorMessage}`,
    `Timestamp: ${report.meta.timestamp}`,
  ];

  const meta = { ...report.meta };
  delete meta.timestamp;

  if (Object.keys(meta).length > 0) {
    lines.push("", "Context:", JSON.stringify(meta, null, 2));
  }

  if (report.stack) {
    lines.push("", "Stack:", report.stack);
  }

  return lines.join("\n");
}

export function logClientError(report: ErrorReport): void {
  console.error("[client-error]", report);
}

export function reportClientError(
  error: unknown,
  meta: Partial<ErrorReportMeta> = {},
): ErrorReport {
  const report = buildErrorReport(error, meta);
  logClientError(report);
  return report;
}

export function logServerError(report: ErrorReport): void {
  console.error("[server-error]", report);
}
