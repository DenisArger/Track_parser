import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs-extra";

const execAsync = promisify(exec);

/**
 * Finds FFmpeg executable path
 * Tries multiple methods:
 * 1. Check if ffmpeg is in PATH
 * 2. Check common installation locations on Windows
 * 3. Return null if not found
 */
export async function findFfmpegPath(): Promise<string | null> {
  // Try to find ffmpeg in PATH
  try {
    const command =
      process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    const { stdout } = await execAsync(command);
    const ffmpegPath = stdout.trim().split("\n")[0].trim();

    if (ffmpegPath && (await fs.pathExists(ffmpegPath))) {
      // Extract directory path (remove executable name)
      const dirPath = path.dirname(ffmpegPath);
      console.log("Found FFmpeg in PATH:", dirPath);
      return dirPath;
    }
  } catch (error) {
    // FFmpeg not in PATH, try common locations
    console.log("FFmpeg not found in PATH, checking common locations...");
  }

  // Check common Windows installation locations
  if (process.platform === "win32") {
    const commonPaths = [
      "C:\\ffmpeg\\bin",
      "C:\\Program Files\\ffmpeg\\bin",
      "C:\\Program Files (x86)\\ffmpeg\\bin",
      path.join(
        process.env.PROGRAMFILES || "C:\\Program Files",
        "ffmpeg",
        "bin"
      ),
      path.join(
        process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
        "ffmpeg",
        "bin"
      ),
    ];

    for (const ffmpegDir of commonPaths) {
      const ffmpegExe = path.join(ffmpegDir, "ffmpeg.exe");
      const ffprobeExe = path.join(ffmpegDir, "ffprobe.exe");

      if (
        (await fs.pathExists(ffmpegExe)) &&
        (await fs.pathExists(ffprobeExe))
      ) {
        console.log("Found FFmpeg in common location:", ffmpegDir);
        return ffmpegDir;
      }
    }
  }

  // Check if ffmpeg is available via which/where (alternative method)
  try {
    const command =
      process.platform === "win32" ? "where ffmpeg.exe" : "which ffmpeg";
    const { stdout } = await execAsync(command);
    const ffmpegPath = stdout.trim().split("\n")[0].trim();

    if (ffmpegPath) {
      const dirPath = path.dirname(ffmpegPath);
      if (await fs.pathExists(dirPath)) {
        console.log("Found FFmpeg via alternative method:", dirPath);
        return dirPath;
      }
    }
  } catch (error) {
    // Ignore
  }

  console.warn(
    "FFmpeg not found. yt-dlp may not work correctly without FFmpeg."
  );
  return null;
}
