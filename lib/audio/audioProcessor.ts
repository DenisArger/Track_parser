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
  maxDuration?: number
): Promise<void> {
  const fs = await import("fs-extra");
  const isNodeRuntime =
    typeof process !== "undefined" && Boolean(process.versions?.node);

  if (!isNodeRuntime) {
    try {
      console.log("Audio processing strategy: ffmpeg.wasm (non-Node runtime)");
      const { processAudioFileWasm } = await import("./audioProcessorWasm");
      await processAudioFileWasm(inputPath, outputPath, maxDuration);
      return;
    } catch (error) {
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

      if (maxDuration != null) {
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

          fs.copy(inputPath, outputPath).then(() => resolve()).catch(reject);
        })
        .run();
    });
  } catch (error) {
    console.warn("Error processing audio, copying original file:", error);
    await fs.copy(inputPath, outputPath);
  }
}
