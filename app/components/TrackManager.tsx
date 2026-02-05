"use client";

import { useState } from "react";
import { useI18n } from "./I18nProvider";

interface TrackStats {
  total: number;
  downloaded: number;
  processed: number;
  trimmed: number;
  rejected: number;
}

interface TrackManagerProps {
  onTracksUpdate?: () => void;
  onRadioMap?: Record<string, boolean>;
}

export default function TrackManager({
  onTracksUpdate,
}: TrackManagerProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const { getTrackStatsAction } = await import(
        "@/lib/actions/trackActions"
      );
      const statsData = await getTrackStatsAction();
      setStats(statsData);
      setMessage(t("manager.statsLoaded"));
      setMessageType("success");
    } catch {
      setMessage(t("manager.statsLoadError"));
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupTracks = async () => {
    setIsLoading(true);
    try {
      const { cleanupTracksAction } = await import(
        "@/lib/actions/trackActions"
      );
      const data = await cleanupTracksAction();
      setStats(data.statsAfter);
      setMessage(t("manager.cleanupSuccess"));
      setMessageType("success");
    } catch {
      setMessage(t("manager.cleanupError"));
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("manager.title")}</h2>
        <p className="text-gray-600 mb-6">
          {t("manager.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stats */}
        <div className="card">
          <h3 className="text-lg font-medium mb-4">{t("manager.statsTitle")}</h3>

          {stats ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t("manager.total")}</span>
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t("manager.downloaded")}</span>
                <span className="font-medium">{stats.downloaded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t("manager.processed")}</span>
                <span className="font-medium">{stats.processed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t("manager.trimmed")}</span>
                <span className="font-medium text-blue-600">
                  {stats.trimmed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t("manager.rejected")}</span>
                <span className="font-medium text-red-600">
                  {stats.rejected}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              {t("manager.statsEmpty")}
            </p>
          )}

          <button
            onClick={loadStats}
            disabled={isLoading}
            className="btn btn-primary mt-4 w-full disabled:opacity-50"
          >
            {isLoading ? t("manager.loading") : t("manager.loadStats")}
          </button>
        </div>

        {/* Cleanup */}
        <div className="card">
          <h3 className="text-lg font-medium mb-4">{t("manager.cleanupTitle")}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t("manager.cleanupDescription")}
          </p>

          <button
            onClick={cleanupTracks}
            disabled={isLoading}
            className="btn btn-secondary w-full disabled:opacity-50"
          >
            {isLoading ? t("manager.cleaning") : t("manager.cleanupAction")}
          </button>
        </div>

        {/* Reset */}
        <div className="card border-amber-200 bg-amber-50/50">
          <h3 className="text-lg font-medium mb-4">{t("manager.resetTitle")}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t("manager.resetDescription")}
          </p>

          <button
            onClick={async () => {
              if (
                !window.confirm(
                  t("manager.resetConfirm")
                )
              ) {
                return;
              }
              setIsLoading(true);
              try {
                const { resetAllDataAction } = await import(
                  "@/lib/actions/trackActions"
                );
                const res = await resetAllDataAction();
                if (res.ok) {
                  setMessage(
                    t("manager.resetSuccess", {
                      deleted: res.deleted,
                      cleared: JSON.stringify(res.cleared),
                    })
                  );
                  setMessageType("success");
                  setStats(null);
                  onTracksUpdate?.();
                } else {
                  setMessage(
                    `${t("manager.resetError")}: ${res.error || t("manager.unknown")}`
                  );
                  setMessageType("error");
                }
              } catch (e) {
                setMessage(
                  `${t("manager.resetError")}: ${
                    e instanceof Error ? e.message : String(e)
                  }`
                );
                setMessageType("error");
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className="btn w-full disabled:opacity-50 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? t("manager.resetting") : t("manager.resetAction")}
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            messageType === "error"
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}

