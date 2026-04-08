/**
 * Processes audio file using FFmpeg.wasm (WebAssembly version)
 * Works in serverless environments like Netlify
 */
export async function processAudioFileWasm(
  inputPath: string,
  outputPath: string,
  maxDuration?: number
): Promise<void> {
  // Dynamic imports to avoid issues during static generation
  // Import fs at the beginning so it's available in catch block
  const fs = await import("fs-extra");
  
  try {
    // Dynamic import to avoid loading in environments where it's not needed
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");

    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      // Optional: log FFmpeg messages
    });

    // Load FFmpeg.wasm
    if (!ffmpeg.loaded) {
      console.log("Loading FFmpeg.wasm...");
      await ffmpeg.load({
        coreURL:
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      });
    }

    // Read input file
    const inputData = await fs.readFile(inputPath);
    const inputFileName = "input.mp3";
    const outputFileName = "output.mp3";

    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputFileName, new Uint8Array(inputData));

    // Build FFmpeg command
    const args: string[] = ["-i", inputFileName];

    if (maxDuration) {
      args.push("-t", maxDuration.toString());
    }

    // Output settings
    args.push("-acodec", "libmp3lame", "-ab", "192k", outputFileName);

    // Run FFmpeg
    console.log("Running FFmpeg.wasm with args:", args.join(" "));
    await ffmpeg.exec(args);

    // Read output file from virtual filesystem
    const outputData = await ffmpeg.readFile(outputFileName);

    // Write output file
    await fs.writeFile(outputPath, Buffer.from(outputData));

    // Cleanup
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    console.log("Audio processing completed with FFmpeg.wasm");
  } catch (error) {
    console.error("FFmpeg.wasm error:", error);
    throw new Error(
      `FFmpeg.wasm processing failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
