import fs from "fs-extra";
import MusicTempo from "music-tempo";

/**
 * Detects BPM using FFmpeg.wasm for conversion and music-tempo for detection
 * Works in serverless environments like Netlify
 */
export async function detectBpmWasm(
  filePath: string
): Promise<number | null> {
  try {
    // Dynamic import to avoid loading in environments where it's not needed
    const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
    
    const ffmpeg = createFFmpeg({
      log: false,
      corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js",
    });

    // Load FFmpeg.wasm
    if (!ffmpeg.isLoaded()) {
      console.log("Loading FFmpeg.wasm for BPM detection...");
      await ffmpeg.load();
    }

    // Read input file
    const inputData = await fs.readFile(filePath);
    const inputFileName = "input.mp3";
    const outputFileName = "output.wav";

    // Write input file to FFmpeg's virtual filesystem
    ffmpeg.FS("writeFile", inputFileName, new Uint8Array(inputData));

    // Convert to WAV (mono, 44.1kHz) for BPM detection
    await ffmpeg.run(
      "-i",
      inputFileName,
      "-ac",
      "1",
      "-ar",
      "44100",
      "-f",
      "wav",
      outputFileName
    );

    // Read output WAV file from virtual filesystem
    const wavData = ffmpeg.FS("readFile", outputFileName);

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
    const mt = new MusicTempo(audioData);
    const bpm = mt.tempo || null;

    // Cleanup
    ffmpeg.FS("unlink", inputFileName);
    ffmpeg.FS("unlink", outputFileName);

    return bpm;
  } catch (error) {
    console.warn("BPM detection with FFmpeg.wasm failed:", error);
    return null;
  }
}

