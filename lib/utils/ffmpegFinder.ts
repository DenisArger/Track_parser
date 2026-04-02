async function getExecAsync() {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    return promisify(exec);
  } catch (_error) {
    return null;
  }
}

export type FfmpegBinarySource =
  | "local-bin"
  | "env"
  | "config"
  | "path"
  | "common-path"
  | "which";

export type FfmpegBinaryPaths = {
  ffmpegPath: string;
  ffprobePath: string;
  source: FfmpegBinarySource;
};

function getBinaryNames() {
  return {
    ffmpeg: process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    ffprobe: process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
  };
}

export async function findFfmpegBinaryPaths(): Promise<FfmpegBinaryPaths | null> {
  const path = await import("path");
  const fs = await import("fs-extra");
  const { isServerlessEnvironment } = await import("./environment");
  const names = getBinaryNames();

  const ensureExecutable = async (filePath: string) => {
    try {
      await fs.chmod(filePath, 0o755);
    } catch (_error) {
      // Ignore chmod failures.
    }
  };

  const verifyPair = async (
    ffmpegPath: string,
    ffprobePath: string,
    source: FfmpegBinarySource
  ): Promise<FfmpegBinaryPaths | null> => {
    if (!(await fs.pathExists(ffmpegPath)) || !(await fs.pathExists(ffprobePath))) {
      return null;
    }

    await ensureExecutable(ffmpegPath);
    await ensureExecutable(ffprobePath);

    return { ffmpegPath, ffprobePath, source };
  };

  try {
    let cwd = "/tmp";
    try {
      cwd = process.cwd();
    } catch (_error) {
      cwd = "/tmp";
    }

    const localBinDir = path.join(cwd, "bin");
    const localMatch = await verifyPair(
      path.join(localBinDir, names.ffmpeg),
      path.join(localBinDir, names.ffprobe),
      "local-bin"
    );
    if (localMatch) {
      return localMatch;
    }
  } catch (_error) {
    // Ignore local-bin lookup failures.
  }

  if (isServerlessEnvironment()) {
    return null;
  }

  if (process.env.FFMPEG_PATH) {
    try {
      const envMatch = await verifyPair(
        path.join(process.env.FFMPEG_PATH, names.ffmpeg),
        path.join(process.env.FFMPEG_PATH, names.ffprobe),
        "env"
      );
      if (envMatch) {
        return envMatch;
      }
    } catch (error) {
      console.warn("FFMPEG_PATH environment variable set but path invalid:", error);
    }
  }

  try {
    const { loadConfig } = await import("@/lib/config");
    const config = await loadConfig();
    if (config.ffmpeg?.path) {
      const configMatch = await verifyPair(
        path.join(config.ffmpeg.path, names.ffmpeg),
        path.join(config.ffmpeg.path, names.ffprobe),
        "config"
      );
      if (configMatch) {
        return configMatch;
      }
    }
  } catch (error) {
    console.warn("Error checking config.json for FFmpeg path:", error);
  }

  try {
    const execAsync = await getExecAsync();
    if (execAsync) {
      const command = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const ffmpegPath = stdout.trim().split("\n")[0].trim();
      if (ffmpegPath) {
        const dirPath = path.dirname(ffmpegPath);
        const pathMatch = await verifyPair(
          ffmpegPath,
          path.join(dirPath, names.ffprobe),
          "path"
        );
        if (pathMatch) {
          return pathMatch;
        }
      }
    }
  } catch (_error) {
    // Continue to common paths.
  }

  try {
    const commonPaths =
      process.platform === "win32"
        ? [
            "C:\\ffmpeg\\bin",
            "C:\\Program Files\\ffmpeg\\bin",
            "C:\\Program Files (x86)\\ffmpeg\\bin",
          ]
        : [
            "/usr/bin",
            "/usr/local/bin",
            "/opt/ffmpeg/bin",
            "/opt/local/bin",
          ];

    for (const dirPath of commonPaths) {
      const commonMatch = await verifyPair(
        path.join(dirPath, names.ffmpeg),
        path.join(dirPath, names.ffprobe),
        "common-path"
      );
      if (commonMatch) {
        return commonMatch;
      }
    }
  } catch (_error) {
    // Continue to alternative lookup.
  }

  try {
    const execAsync = await getExecAsync();
    if (execAsync) {
      const command = process.platform === "win32" ? "where ffmpeg.exe" : "which ffmpeg";
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const ffmpegPath = stdout.trim().split("\n")[0].trim();
      if (ffmpegPath) {
        const dirPath = path.dirname(ffmpegPath);
        const whichMatch = await verifyPair(
          ffmpegPath,
          path.join(dirPath, names.ffprobe),
          "which"
        );
        if (whichMatch) {
          return whichMatch;
        }
      }
    }
  } catch (_error) {
    // Ignore.
  }

  return null;
}

export async function findFfmpegPath(): Promise<string | null> {
  const match = await findFfmpegBinaryPaths();
  if (!match) {
    return null;
  }

  const path = await import("path");
  return path.dirname(match.ffmpegPath);
}
