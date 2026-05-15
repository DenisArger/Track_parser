"use client";

import { useState } from "react";

interface ErrorNoticeProps {
  title: string;
  description: string;
  errorId?: string;
  details?: string;
  onReset: () => void;
  resetLabel: string;
  copyLabel?: string;
  copySuccessLabel?: string;
  copyErrorLabel?: string;
  hint?: string;
}

export default function ErrorNotice({
  title,
  description,
  errorId,
  details,
  onReset,
  resetLabel,
  copyLabel = "Copy details",
  copySuccessLabel = "Copied",
  copyErrorLabel = "Unable to copy. Please copy manually.",
  hint,
}: ErrorNoticeProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const handleCopy = async () => {
    if (!details) {
      return;
    }

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{description}</p>
        {hint ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {hint}
          </p>
        ) : null}
        {errorId ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {errorId}
          </p>
        ) : null}

        {details ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 mb-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="font-medium">{copyLabel}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline"
              >
                {copyStatus === "copied" ? copySuccessLabel : copyLabel}
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words max-h-52 overflow-auto">
              {details}
            </pre>
            {copyStatus === "failed" ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {copyErrorLabel}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onReset}
          className="w-full bg-primary-600 dark:bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
