import type { TrackStatus } from "@/types/track";

export const LEGACY_TO_CURRENT_STATUS: Record<string, TrackStatus> = {
  processed: "reviewed_approved",
  uploaded: "ready_for_upload",
};

export function normalizeTrackStatus(status: string | null | undefined): TrackStatus {
  if (!status) return "downloaded";
  return (LEGACY_TO_CURRENT_STATUS[status] || status) as TrackStatus;
}
