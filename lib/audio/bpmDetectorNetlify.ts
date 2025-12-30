// Dynamic imports to avoid issues during static generation
// import fs from "fs-extra";
// import { isServerlessEnvironment } from "@/lib/utils/environment";

/**
 * Detects BPM using music-tempo library
 * In serverless, tries to use ArrayBuffer directly without FFmpeg conversion
 * Falls back gracefully if conversion is needed
 */
export async function detectBpmNetlify(
  filePath: string
): Promise<number | null> {
  // Dynamic import to avoid issues during static generation
  const { isServerlessEnvironment } = await import("@/lib/utils/environment");

  // Try FFmpeg.wasm first (works in serverless)
  try {
    console.log("Trying FFmpeg.wasm for BPM detection...");
    const { detectBpmWasm } = await import("./bpmDetectorWasm");
    const bpm = await detectBpmWasm(filePath);
    if (bpm) {
      return bpm;
    }
  } catch (wasmError) {
    console.warn(
      "FFmpeg.wasm BPM detection failed, trying native FFmpeg:",
      wasmError instanceof Error ? wasmError.message : String(wasmError)
    );
  }

  // Try to use native FFmpeg if available
  try {
    const { findFfmpegPath } = await import("@/lib/utils/ffmpegFinder");
    const ffmpegPath = await findFfmpegPath();

    if (!ffmpegPath) {
      console.warn("Native FFmpeg not found. BPM detection skipped.");
      return null;
    }

    // Use original BPM detection with native FFmpeg
    const { detectBpm } = await import("./bpmDetector");
    return await detectBpm(filePath);
  } catch (error) {
    console.warn("Error detecting BPM with native FFmpeg:", error);
    return null;
  }
}

/**
 * Detects BPM from audio buffer (for client-side processing)
 * This can be used in browser with Web Audio API
 */
export async function detectBpmFromBuffer(audioBuffer: Float32Array): Promise<number | null> {
  try {
    // Dynamic import to avoid issues during static generation
    const MusicTempo = (await import("music-tempo")).default;
    const audioData = Array.from(audioBuffer);
    const mt = new MusicTempo(audioData);
    return mt.tempo || null;
  } catch (error) {
    console.warn("Error detecting BPM from buffer:", error);
    return null;
  }
}

