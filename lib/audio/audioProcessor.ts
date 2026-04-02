// Dynamic imports to avoid issues during static generation
// import fs from "fs-extra";
// import path from "path";

export interface TrimSettings {
  startTime: number;
  endTime?: number;
  fadeIn: number;
  fadeOut: number;
  maxDuration?: number;
}

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

/**
 * Processes audio file (trimming, fading)
 * Tries FFmpeg.wasm first (works in serverless), then native FFmpeg.
 * If processing was requested, failures are surfaced instead of silently copying the source file.
 */
export async function processAudioFile(
  inputPath: string,
  outputPath: string,
  trimSettings?: TrimSettings,
  maxDuration?: number
): Promise<void> {
  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");
  const { isServerlessEnvironment } = await import("@/lib/utils/environment");
  const requestedDuration = resolveRequestedDuration(trimSettings, maxDuration);
  const requiresProcessing =
    trimSettings != null ||
    (requestedDuration != null && requestedDuration > 0);

  // In serverless, try FFmpeg.wasm first, then fall back to bundled/native FFmpeg.
  if (isServerlessEnvironment()) {
    try {
      console.log(
        "Using FFmpeg.wasm for audio processing in serverless environment"
      );
      const { processAudioFileWasm } = await import("./audioProcessorWasm");
      await processAudioFileWasm(
        inputPath,
        outputPath,
        trimSettings,
        maxDuration
      );
      return;
    } catch (error) {
      console.warn(
        "FFmpeg.wasm failed in serverless environment, trying native FFmpeg:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (!isServerlessEnvironment()) {
    // Try FFmpeg.wasm first (works everywhere, including when native FFmpeg is not available)
    try {
      console.log("Trying FFmpeg.wasm for audio processing...");
      const { processAudioFileWasm } = await import("./audioProcessorWasm");
      await processAudioFileWasm(
        inputPath,
        outputPath,
        trimSettings,
        maxDuration
      );
      return;
    } catch (wasmError) {
      console.warn(
        "FFmpeg.wasm failed, trying native FFmpeg:",
        wasmError instanceof Error ? wasmError.message : String(wasmError)
      );
    }
  }

  // Try to use native FFmpeg if available
  try {
    const { findFfmpegPath } = await import("@/lib/utils/ffmpegFinder");
    const ffmpegPath = await findFfmpegPath();

    if (!ffmpegPath) {
      if (requiresProcessing) {
        throw new Error("Native FFmpeg not found for requested audio processing");
      }

      console.warn("Native FFmpeg not found. Copying original file without processing.");
      await fs.copy(inputPath, outputPath);
      return;
    }

    // Use FFmpeg for processing
    // Dynamic import to avoid issues during static generation
    const ffmpeg = (await import("fluent-ffmpeg")).default;
    const ffmpegInstance = ffmpeg(inputPath);

    // Set FFmpeg path if found (with platform-specific extension)
    const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const ffprobeExe = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    ffmpegInstance.setFfmpegPath(path.join(ffmpegPath, ffmpegExe));
    ffmpegInstance.setFfprobePath(path.join(ffmpegPath, ffprobeExe));

    await new Promise<void>((resolve, reject) => {
      let command = ffmpegInstance;

      if (trimSettings) {
        const duration = resolveRequestedDuration(trimSettings, maxDuration);

        // Set start time
        command = command.setStartTime(trimSettings.startTime);

        // Set duration
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
      } else if (maxDuration) {
        command = command.setStartTime(0).duration(maxDuration);
      }

      command
        .output(outputPath)
        .on("end", () => {
          console.log("Audio processing completed");
          resolve();
        })
        .on("error", (error: any) => {
          console.error("FFmpeg processing error:", error);
          if (requiresProcessing) {
            reject(error);
            return;
          }

          fs.copy(inputPath, outputPath).then(() => resolve()).catch(reject);
        })
        .run();
    });
  } catch (error) {
    if (requiresProcessing) {
      throw error;
    }

    console.warn("Error processing audio, copying original file:", error);
    await fs.copy(inputPath, outputPath);
  }
}
