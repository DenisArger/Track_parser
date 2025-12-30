import path from "path";
import fs from "fs-extra";

// Lazy initialization of exec to avoid issues in serverless
// Don't create execAsync at module level - create it when needed
function getExecAsync() {
  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    return promisify(exec);
  } catch (error) {
    // exec may not be available in serverless
    return null;
  }
}

/**
 * Finds FFmpeg executable path
 * Tries multiple methods (in order of priority):
 * 1. Check FFMPEG_PATH environment variable
 * 2. Check config.json ffmpeg.path setting
 * 3. Check if ffmpeg is in PATH
 * 4. Check common installation locations (Windows/Linux)
 * 5. Return null if not found
 *
 * This function is safe to call in production and will never throw errors.
 * It gracefully handles all failures and returns null if FFmpeg is not found.
 */
export async function findFfmpegPath(): Promise<string | null> {
  // In serverless environments, exec/spawn may not be available
  // Skip FFmpeg search in serverless to avoid errors
  const { isServerlessEnvironment } = await import("./environment");
  if (isServerlessEnvironment()) {
    console.log("Skipping FFmpeg search in serverless environment");
    return null;
  }

  // Check local bin directory first (highest priority for bundled binaries)
  try {
    const localBinDir = path.join(process.cwd(), "bin");
    const ffmpegExe = path.join(
      localBinDir,
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
    );
    const ffprobeExe = path.join(
      localBinDir,
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
    );

    if (
      (await fs.pathExists(ffmpegExe)) &&
      (await fs.pathExists(ffprobeExe))
    ) {
      console.log("Found FFmpeg in local bin directory:", localBinDir);
      return localBinDir;
    }
  } catch (error) {
    // Ignore - local bin might not exist
  }

  // Check environment variable (second priority)
  if (process.env.FFMPEG_PATH) {
    try {
      const envPath = process.env.FFMPEG_PATH;
      const ffmpegExe = path.join(
        envPath,
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
      );
      const ffprobeExe = path.join(
        envPath,
        process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
      );

      if (
        (await fs.pathExists(ffmpegExe)) &&
        (await fs.pathExists(ffprobeExe))
      ) {
        console.log("Found FFmpeg via FFMPEG_PATH environment variable:", envPath);
        return envPath;
      }
    } catch (error) {
      console.warn("FFMPEG_PATH environment variable set but path invalid:", error);
    }
  }

  // Check config.json (third priority)
  try {
    const { loadConfig } = await import("@/lib/config");
    const config = await loadConfig();
    if (config.ffmpeg?.path) {
      const configPath = config.ffmpeg.path;
      const ffmpegExe = path.join(
        configPath,
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
      );
      const ffprobeExe = path.join(
        configPath,
        process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
      );

      if (
        (await fs.pathExists(ffmpegExe)) &&
        (await fs.pathExists(ffprobeExe))
      ) {
        console.log("Found FFmpeg via config.json:", configPath);
        return configPath;
      }
    }
  } catch (error) {
    // Ignore config errors - not critical
    console.warn("Error checking config.json for FFmpeg path:", error);
  }

  // Wrap everything in try-catch to ensure it never throws in production
  try {
    // Try to find ffmpeg in PATH
    try {
      const execAsync = getExecAsync();
      if (!execAsync) {
        // exec not available, skip PATH check
        throw new Error("exec not available");
      }

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

    // Check common installation locations based on platform
    try {
      let commonPaths: string[] = [];

      if (process.platform === "win32") {
        // Windows common paths (local bin already checked above)
        commonPaths = [
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
      } else {
        // Linux/Unix common paths (local bin already checked above)
        commonPaths = [
          "/usr/bin",
          "/usr/local/bin",
          "/opt/ffmpeg/bin",
          "/opt/local/bin",
          path.join(process.env.HOME || "/home", "ffmpeg", "bin"),
        ];
      }

      for (const ffmpegDir of commonPaths) {
        try {
          const ffmpegExe = path.join(
            ffmpegDir,
            process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
          );
          const ffprobeExe = path.join(
            ffmpegDir,
            process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
          );

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

    // Check if ffmpeg is available via which/where (alternative method)
    try {
      const execAsync = getExecAsync();
      if (!execAsync) {
        // exec not available, skip
        throw new Error("exec not available");
      }

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
