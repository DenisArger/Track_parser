"use client";

import { useState } from "react";

interface ErrorDetailsProps {
  title?: string;
  message: string;
  details?: string;
  copyLabel?: string;
  copySuccessLabel?: string;
  copyErrorLabel?: string;
}

export default function ErrorDetails({
  title = "Error",
  message,
  details,
  copyLabel = "Copy details",
  copySuccessLabel = "Copied",
  copyErrorLabel = "Unable to copy. Please copy manually.",
}: ErrorDetailsProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const handleCopy = async () => {
    if (!details) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details);
      } else if (typeof window !== "undefined") {
        window.prompt("Copy the error details:", details);
      }
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-red-900 dark:text-red-100">
            {title}
          </p>
          <p className="mt-2 text-sm text-red-700 dark:text-red-200">
            {message}
          </p>
        </div>
        {details ? (
          <button
            type="button"
            onClick={handleCopy}
            className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline"
          >
            {copyStatus === "copied" ? copySuccessLabel : copyLabel}
          </button>
        ) : null}
      </div>
      {details ? (
        <pre className="mt-3 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-44 overflow-auto">
          {details}
        </pre>
      ) : null}
      {copyStatus === "failed" ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {copyErrorLabel}
        </p>
      ) : null}
    </div>
  );
}
