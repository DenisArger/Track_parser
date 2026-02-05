"use client";

import { useEffect } from "react";
import { useI18n } from "../components/I18nProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("Application error:", error);
    console.error("Error digest:", error.digest);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t("errorPage.title")}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t("errorPage.subtitle")}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {t("errorPage.errorId")}: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="w-full bg-primary-600 dark:bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
        >
          {t("errorPage.tryAgain")}
        </button>
      </div>
    </div>
  );
}
