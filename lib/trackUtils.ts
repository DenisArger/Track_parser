// Функция для очистки неправильно помеченных треков
export async function cleanupTrackStatuses(): Promise<void> {
  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");
  const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");

  // Check if we're in a build-time environment
  if (typeof process !== "undefined" && process.env.NEXT_PHASE === "phase-production-build") {
    console.log("Build time detected, skipping cleanup");
    return;
  }

  const workingDir = getSafeWorkingDirectory();
  const tracksPath = path.join(workingDir, "tracks.json");

  if (!(await fs.pathExists(tracksPath))) {
    console.log("tracks.json not found");
    return;
  }

  const tracksData = await fs.readJson(tracksPath);
  let hasChanges = false;

  if (hasChanges) {
    await fs.writeJson(tracksPath, tracksData, { spaces: 2 });
    console.log("Track statuses cleaned up successfully");
  } else {
    console.log("No track status cleanup needed");
  }
}

// Функция для получения статистики треков
export async function getTrackStats(): Promise<{
  total: number;
  downloaded: number;
  processed: number;
  approved: number;
  rejected: number;
  readyForUpload: number;
  uploaded: number;
  uploadedRadio: number;
}> {
  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");
  const { getSafeWorkingDirectory } = await import("@/lib/utils/environment");

  // Check if we're in a build-time environment
  if (typeof process !== "undefined" && process.env.NEXT_PHASE === "phase-production-build") {
    return {
      total: 0,
      downloaded: 0,
      processed: 0,
      approved: 0,
      rejected: 0,
      readyForUpload: 0,
      uploaded: 0,
      uploadedRadio: 0,
    };
  }

  const workingDir = getSafeWorkingDirectory();
  const tracksPath = path.join(workingDir, "tracks.json");

  if (!(await fs.pathExists(tracksPath))) {
    return {
      total: 0,
      downloaded: 0,
      processed: 0,
      approved: 0,
      rejected: 0,
      readyForUpload: 0,
      uploaded: 0,
      uploadedRadio: 0,
    };
  }

  const tracksData = await fs.readJson(tracksPath);

  const stats = {
    total: tracksData.length,
    downloaded: 0,
    processed: 0,
    approved: 0,
    rejected: 0,
    readyForUpload: 0,
    uploaded: 0,
    uploadedRadio: 0,
  };

  for (const track of tracksData) {
    switch (track.status) {
      case "downloaded":
        stats.downloaded++;
        break;
      case "reviewed_approved":
        stats.approved++;
        break;
      case "reviewed_rejected":
        stats.rejected++;
        break;
      case "ready_for_upload":
        stats.readyForUpload++;
        break;
      case "uploaded_ftp":
        stats.uploaded++;
        break;
      case "uploaded_radio":
        stats.uploadedRadio++;
        break;
    }

  }

  return stats;
}
