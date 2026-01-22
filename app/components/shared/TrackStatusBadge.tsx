import { TrackStatus } from "@/types/track";

interface TrackStatusBadgeProps {
  status: TrackStatus;
  className?: string;
}

export default function TrackStatusBadge({
  status,
  className = "",
}: TrackStatusBadgeProps) {
  const getStatusStyles = (status: TrackStatus) => {
    switch (status) {
      case "uploaded":
        return "bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-300";
      case "processed":
        return "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300";
      case "downloaded":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "rejected":
        return "bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-300";
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
      {status}
    </span>
  );
}
