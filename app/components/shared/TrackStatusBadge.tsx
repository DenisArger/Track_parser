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
        return "bg-success-100 text-success-800";
      case "processed":
        return "bg-primary-100 text-primary-800";
      case "downloaded":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-danger-100 text-danger-800";
      case "downloading":
      case "processing":
      case "uploading":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
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
