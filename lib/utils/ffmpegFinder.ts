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
 *
 * This function is safe to call in production and will never throw errors.
 * It gracefully handles all failures and returns null if FFmpeg is not found.
 */
export async function findFfmpegPath(): Promise<string | null> {
  // Wrap everything in try-catch to ensure it never throws in production
  try {
    // Try to find ffmpeg in PATH
    try {
      const command =
        process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const ffmpegPath = stdout.trim().split("\n")[0].trim();

      if (ffmpegPath) {
        try {
          if (await fs.pathExists(ffmpegPath)) {
            // Extract directory path (remove executable name)
            const dirPath = path.dirname(ffmpegPath);
            console.log("Found FFmpeg in PATH:", dirPath);
            return dirPath;
          }
        } catch (fsError) {
          // Ignore file system errors
          console.log("Error checking FFmpeg path:", fsError);
        }
      }
    } catch (error) {
      // FFmpeg not in PATH, try common locations
      // Silently continue - this is expected in many cases
      // exec might not be available in some production environments
    }

    // Check common Windows installation locations
    if (process.platform === "win32") {
      try {
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
          try {
            const ffmpegExe = path.join(ffmpegDir, "ffmpeg.exe");
            const ffprobeExe = path.join(ffmpegDir, "ffprobe.exe");

            if (
              (await fs.pathExists(ffmpegExe)) &&
              (await fs.pathExists(ffprobeExe))
            ) {
              console.log("Found FFmpeg in common location:", ffmpegDir);
              return ffmpegDir;
            }
          } catch (pathError) {
            // Continue to next path
            continue;
          }
        }
      } catch (error) {
        // Ignore errors when checking common paths
      }
    }

    // Check if ffmpeg is available via which/where (alternative method)
    try {
      const command =
        process.platform === "win32" ? "where ffmpeg.exe" : "which ffmpeg";
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const ffmpegPath = stdout.trim().split("\n")[0].trim();

      if (ffmpegPath) {
        try {
          const dirPath = path.dirname(ffmpegPath);
          if (await fs.pathExists(dirPath)) {
            console.log("Found FFmpeg via alternative method:", dirPath);
            return dirPath;
          }
        } catch (fsError) {
          // Ignore
        }
      }
    } catch (error) {
      // Ignore - this is expected if ffmpeg is not found
      // exec might not be available in some production environments
    }
  } catch (error) {
    // Catch-all: ensure we never throw
    console.warn("Error in findFfmpegPath (non-critical):", error);
  }

  // Return null if not found - this is not an error condition
  return null;
}
