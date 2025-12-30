// Dynamic imports to avoid issues during static generation
// import fs from "fs-extra";
// Dynamic import to avoid issues during static generation
// import MusicTempo from "music-tempo";

/**
 * Detects BPM using FFmpeg.wasm for conversion and music-tempo for detection
 * Works in serverless environments like Netlify
 */
export async function detectBpmWasm(
  filePath: string
): Promise<number | null> {
  try {
    // Dynamic imports to avoid issues during static generation
    const fs = await import("fs-extra");
    // Dynamic import to avoid loading in environments where it's not needed
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    
    const ffmpeg = new FFmpeg();

    // Load FFmpeg.wasm
    if (!ffmpeg.loaded) {
      console.log("Loading FFmpeg.wasm for BPM detection...");
      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      });
    }

    // Read input file
    const inputData = await fs.readFile(filePath);
    const inputFileName = "input.mp3";
    const outputFileName = "output.wav";

    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputFileName, new Uint8Array(inputData));

    // Convert to WAV (mono, 44.1kHz) for BPM detection
    await ffmpeg.exec([
      "-i",
      inputFileName,
      "-ac",
      "1",
      "-ar",
      "44100",
      "-f",
      "wav",
      outputFileName,
    ]);

    // Read output WAV file from virtual filesystem
    const wavData = await ffmpeg.readFile(outputFileName);

    // Parse WAV file
    // WAV PCM starts at byte 44 (header)
    const wavBuffer = Buffer.from(wavData);
    const pcm = new Int16Array(
      wavBuffer.buffer,
      wavBuffer.byteOffset + 44,
      (wavBuffer.length - 44) / 2
    );

    // Convert to array of numbers [-1, 1]
    const audioData = Array.from(pcm).map((x) => x / 32768);

    // Detect BPM
    // Dynamic import to avoid issues during static generation
    const MusicTempo = (await import("music-tempo")).default;
    const mt = new MusicTempo(audioData);
    const bpm = mt.tempo || null;

    // Cleanup
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return bpm;
  } catch (error) {
    console.warn("BPM detection with FFmpeg.wasm failed:", error);
    return null;
  }
}

