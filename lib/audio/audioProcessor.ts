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

/**
 * Processes audio file (trimming, fading)
 * Tries FFmpeg.wasm first (works in serverless), then native FFmpeg, then fallback to copy
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

  // In serverless, try FFmpeg.wasm first
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
        "FFmpeg.wasm failed, copying original file:",
        error instanceof Error ? error.message : String(error)
      );
      // Fallback: copy original file
      await fs.copy(inputPath, outputPath);
      return;
    }
  }

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

  // Try to use native FFmpeg if available
  try {
    const { findFfmpegPath } = await import("@/lib/utils/ffmpegFinder");
    const ffmpegPath = await findFfmpegPath();

    if (!ffmpegPath) {
      console.warn(
        "Native FFmpeg not found. Copying original file without processing."
      );
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
        // Set start time
        command = command.setStartTime(trimSettings.startTime);

        // Set duration
        if (trimSettings.endTime) {
          const duration = trimSettings.endTime - trimSettings.startTime;
          command = command.duration(duration);
        } else if (trimSettings.maxDuration) {
          command = command.duration(trimSettings.maxDuration);
        } else if (maxDuration) {
          command = command.duration(maxDuration);
        }

        // Apply fade in
        if (trimSettings.fadeIn > 0) {
          command = command.audioFilters(
            `afade=t=in:st=${trimSettings.startTime}:d=${trimSettings.fadeIn}`
          );
        }

        // Apply fade out
        if (trimSettings.fadeOut > 0) {
          const fadeOutStart = trimSettings.endTime
            ? trimSettings.endTime - trimSettings.fadeOut
            : trimSettings.startTime +
              (trimSettings.maxDuration || maxDuration || 360) -
              trimSettings.fadeOut;
          command = command.audioFilters(
            `afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`
          );
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
          console.error("FFmpeg error, falling back to copy:", error);
          // Fallback: copy original file
          fs.copy(inputPath, outputPath)
            .then(() => resolve())
            .catch(reject);
        })
        .run();
    });
  } catch (error) {
    console.warn("Error processing audio, copying original file:", error);
    // Fallback: copy original file
    await fs.copy(inputPath, outputPath);
  }
}
