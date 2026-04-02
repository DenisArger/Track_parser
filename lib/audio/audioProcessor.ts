export interface TrimSettings {
  startTime: number;
  endTime?: number;
  fadeIn: number;
  fadeOut: number;
  maxDuration?: number;
}

type NativeFfmpegSelection = {
  ffmpegPath: string;
  ffprobePath: string;
  source:
    | "installer"
    | "local-bin"
    | "env"
    | "config"
    | "path"
    | "common-path"
    | "which";
};

function resolveRequestedDuration(
  trimSettings?: TrimSettings,
  maxDuration?: number
): number | undefined {
  if (!trimSettings) {
    return maxDuration;
  }

  if (trimSettings.endTime != null) {
    return trimSettings.endTime - trimSettings.startTime;
  }

  if (trimSettings.maxDuration != null) {
    return trimSettings.maxDuration;
  }

  return maxDuration;
}

async function resolveNativeFfmpeg(): Promise<NativeFfmpegSelection | null> {
  const fs = await import("fs-extra");

  const ensureExecutable = async (filePath: string) => {
    try {
      await fs.chmod(filePath, 0o755);
    } catch (_error) {
      // Ignore chmod failures; the subsequent execution will surface real issues.
    }
  };

  try {
    const ffmpegInstallerModule = await import("@ffmpeg-installer/ffmpeg");
    const ffprobeInstallerModule = await import("@ffprobe-installer/ffprobe");
    const ffmpegInstaller = ffmpegInstallerModule.default ?? ffmpegInstallerModule;
    const ffprobeInstaller = ffprobeInstallerModule.default ?? ffprobeInstallerModule;

    if (ffmpegInstaller?.path && ffprobeInstaller?.path) {
      await ensureExecutable(ffmpegInstaller.path);
      await ensureExecutable(ffprobeInstaller.path);
      return {
        ffmpegPath: ffmpegInstaller.path,
        ffprobePath: ffprobeInstaller.path,
        source: "installer",
      };
    }
  } catch (error) {
    console.warn(
      "FFmpeg installer packages unavailable, trying finder fallback:",
      error instanceof Error ? error.message : String(error)
    );
  }

  const { findFfmpegBinaryPaths } = await import("@/lib/utils/ffmpegFinder");
  return findFfmpegBinaryPaths();
}

/**
 * Processes audio file (trimming, fading).
 * In Node runtimes we always use native FFmpeg binaries.
 * FFmpeg.wasm is intentionally not used from server actions/serverless Node.
 */
export async function processAudioFile(
  inputPath: string,
  outputPath: string,
  trimSettings?: TrimSettings,
  maxDuration?: number
): Promise<void> {
  const fs = await import("fs-extra");
  const requestedDuration = resolveRequestedDuration(trimSettings, maxDuration);
  const requiresProcessing =
    trimSettings != null ||
    (requestedDuration != null && requestedDuration > 0);
  const isNodeRuntime =
    typeof process !== "undefined" && Boolean(process.versions?.node);

  if (!isNodeRuntime) {
    try {
      console.log("Audio processing strategy: ffmpeg.wasm (non-Node runtime)");
      const { processAudioFileWasm } = await import("./audioProcessorWasm");
      await processAudioFileWasm(inputPath, outputPath, trimSettings, maxDuration);
      return;
    } catch (error) {
      if (requiresProcessing) {
        throw new Error(
          `Audio processing failed in non-Node runtime via ffmpeg.wasm: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      console.warn("Non-Node ffmpeg.wasm failed, copying original file:", error);
      await fs.copy(inputPath, outputPath);
      return;
    }
  }

  const { isServerlessEnvironment } = await import("@/lib/utils/environment");
  const nativeFfmpeg = await resolveNativeFfmpeg();

  console.log("Audio processing runtime:", {
    runtime: "node",
    serverless: isServerlessEnvironment(),
    strategy: "native-ffmpeg",
    ffmpegSource: nativeFfmpeg?.source ?? "unavailable",
    ffmpegPath: nativeFfmpeg?.ffmpegPath ?? null,
    ffprobePath: nativeFfmpeg?.ffprobePath ?? null,
  });

  try {
    if (!nativeFfmpeg) {
      if (requiresProcessing) {
        throw new Error("Native FFmpeg not found for requested audio processing");
      }

      console.warn("Native FFmpeg not found. Copying original file without processing.");
      await fs.copy(inputPath, outputPath);
      return;
    }

    const ffmpeg = (await import("fluent-ffmpeg")).default;
    const ffmpegInstance = ffmpeg(inputPath);

    ffmpegInstance.setFfmpegPath(nativeFfmpeg.ffmpegPath);
    ffmpegInstance.setFfprobePath(nativeFfmpeg.ffprobePath);

    await new Promise<void>((resolve, reject) => {
      let command = ffmpegInstance;

      if (trimSettings) {
        const duration = resolveRequestedDuration(trimSettings, maxDuration);

        command = command.setStartTime(trimSettings.startTime);

        if (trimSettings.endTime != null && duration != null) {
          command = command.duration(duration);
        } else if (trimSettings.maxDuration != null) {
          command = command.duration(trimSettings.maxDuration);
        } else if (maxDuration != null) {
          command = command.duration(maxDuration);
        }

        const audioFilters: string[] = [];

        if (trimSettings.fadeIn > 0) {
          audioFilters.push(`afade=t=in:st=0:d=${trimSettings.fadeIn}`);
        }

        if (trimSettings.fadeOut > 0 && duration != null) {
          const fadeOutStart = Math.max(0, duration - trimSettings.fadeOut);
          audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`);
        }

        if (audioFilters.length > 0) {
          command = command.audioFilters(audioFilters);
        }
      } else if (maxDuration != null) {
        command = command.setStartTime(0).duration(maxDuration);
      }

      command
        .output(outputPath)
        .on("end", () => {
          console.log("Audio processing completed");
          resolve();
        })
        .on("error", (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error("FFmpeg processing error:", {
            message,
            ffmpegSource: nativeFfmpeg.source,
            ffmpegPath: nativeFfmpeg.ffmpegPath,
            ffprobePath: nativeFfmpeg.ffprobePath,
          });

          if (requiresProcessing) {
            reject(
              new Error(
                `Native FFmpeg processing failed via ${nativeFfmpeg.source}: ${message}`
              )
            );
            return;
          }

          fs.copy(inputPath, outputPath).then(() => resolve()).catch(reject);
        })
        .run();
    });
  } catch (error) {
    if (requiresProcessing) {
      throw new Error(
        `Native audio processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    console.warn("Error processing audio, copying original file:", error);
    await fs.copy(inputPath, outputPath);
  }
}
