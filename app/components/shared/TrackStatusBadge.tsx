"use client";

import { TrackStatus } from "@/types/track";
import { useI18n } from "../I18nProvider";

interface TrackStatusBadgeProps {
  status: TrackStatus;
  className?: string;
}

export default function TrackStatusBadge({
  status,
  className = "",
}: TrackStatusBadgeProps) {
  const { t } = useI18n();

  const getStatusStyles = (status: TrackStatus) => {
    switch (status) {
      case "uploaded_ftp":
        return "bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-300";
      case "uploaded_radio":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300";
      case "reviewed_approved":
        return "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300";
      case "reviewed_rejected":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
      case "ready_for_upload":
        return "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300";
      case "downloaded":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "downloading":
      case "processing":
      case "uploading":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      case "error":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusStyles(
        status
      )} ${className}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
