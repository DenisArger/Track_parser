import fs from "fs-extra";
import { isServerlessEnvironment } from "@/lib/utils/environment";

export interface TrimSettings {
  startTime: number;
  endTime?: number;
  fadeIn: number;
  fadeOut: number;
  maxDuration?: number;
}

/**
 * Processes audio file using FFmpeg.wasm (WebAssembly version)
 * Works in serverless environments like Netlify
 */
export async function processAudioFileWasm(
  inputPath: string,
  outputPath: string,
  trimSettings?: TrimSettings,
  maxDuration?: number
): Promise<void> {
  try {
    // Dynamic import to avoid loading in environments where it's not needed
    const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
    
    const ffmpeg = createFFmpeg({
      log: false, // Set to true for debugging
      corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js",
    });

    // Load FFmpeg.wasm
    if (!ffmpeg.isLoaded()) {
      console.log("Loading FFmpeg.wasm...");
      await ffmpeg.load();
    }

    // Read input file
    const inputData = await fs.readFile(inputPath);
    const inputFileName = "input.mp3";
    const outputFileName = "output.mp3";

    // Write input file to FFmpeg's virtual filesystem
    ffmpeg.FS("writeFile", inputFileName, new Uint8Array(inputData));

    // Build FFmpeg command
    const args: string[] = ["-i", inputFileName];

    if (trimSettings) {
      // Set start time
      if (trimSettings.startTime > 0) {
        args.push("-ss", trimSettings.startTime.toString());
      }

      // Calculate duration
      let duration: number;
      if (trimSettings.endTime) {
        duration = trimSettings.endTime - trimSettings.startTime;
      } else if (trimSettings.maxDuration) {
        duration = trimSettings.maxDuration;
      } else if (maxDuration) {
        duration = maxDuration;
      } else {
        duration = 360; // Default 6 minutes
      }

      args.push("-t", duration.toString());

      // Build audio filter for fade in/out
      const audioFilters: string[] = [];
      
      // Apply fade in
      if (trimSettings.fadeIn > 0) {
        audioFilters.push(
          `afade=t=in:st=${trimSettings.startTime}:d=${trimSettings.fadeIn}`
        );
      }

      // Apply fade out
      if (trimSettings.fadeOut > 0) {
        const fadeOutStart = trimSettings.endTime
          ? trimSettings.endTime - trimSettings.fadeOut
          : trimSettings.startTime + duration - trimSettings.fadeOut;
        audioFilters.push(
          `afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`
        );
      }

      // Apply audio filters if any
      if (audioFilters.length > 0) {
        args.push("-af", audioFilters.join(","));
      }
    } else if (maxDuration) {
      args.push("-t", maxDuration.toString());
    }

    // Output settings
    args.push("-acodec", "libmp3lame", "-ab", "192k", outputFileName);

    // Run FFmpeg
    console.log("Running FFmpeg.wasm with args:", args.join(" "));
    await ffmpeg.run(...args);

    // Read output file from virtual filesystem
    const outputData = ffmpeg.FS("readFile", outputFileName);

    // Write output file
    await fs.writeFile(outputPath, Buffer.from(outputData));

    // Cleanup
    ffmpeg.FS("unlink", inputFileName);
    ffmpeg.FS("unlink", outputFileName);

    console.log("Audio processing completed with FFmpeg.wasm");
  } catch (error) {
    console.error("FFmpeg.wasm error:", error);
    // Fallback: copy original file
    console.warn("Falling back to copy original file");
    await fs.copy(inputPath, outputPath);
    throw new Error(
      `FFmpeg.wasm processing failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

