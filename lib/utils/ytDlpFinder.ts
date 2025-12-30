import path from "path";
import fs from "fs-extra";
import { isServerlessEnvironment } from "./environment";

/**
 * Gets the path to yt-dlp executable
 * Cross-platform support: Windows (.exe) and Linux/Unix (no extension)
 * Returns null in serverless environments
 */
export async function getYtDlpPath(): Promise<string | null> {
  // In serverless environments, we can't use yt-dlp
  if (isServerlessEnvironment()) {
    return null;
  }

  try {
    const binDir = path.join(process.cwd(), "bin");
    const executableName =
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const ytDlpPath = path.join(binDir, executableName);

    // Check if yt-dlp exists in bin directory
    if (await fs.pathExists(ytDlpPath)) {
      return ytDlpPath;
    }

    // Try to find yt-dlp in PATH (for Linux systems where it might be installed globally)
    if (process.platform !== "win32") {
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);

        const { stdout } = await execAsync("which yt-dlp", { timeout: 5000 });
        const pathInSystem = stdout.trim().split("\n")[0].trim();

        if (pathInSystem && (await fs.pathExists(pathInSystem))) {
          return pathInSystem;
        }
      } catch (error) {
        // yt-dlp not in PATH, continue
      }
    }

    return null;
  } catch (error) {
    console.warn("Error finding yt-dlp path:", error);
    return null;
  }
}


