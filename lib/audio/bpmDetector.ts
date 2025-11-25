import fs from "fs-extra";
import MusicTempo from "music-tempo";

/**
 * Определяет BPM трека через music-tempo
 */
export async function detectBpm(filePath: string): Promise<number | null> {
  const wavPath = filePath.replace(/\.[^.]+$/, ".bpm.wav");
  const ffmpeg = require("fluent-ffmpeg");

  // 1. Сконвертировать в wav (моно, 44.1kHz)
  await new Promise<void>((resolve, reject) => {
    ffmpeg(filePath)
      .audioChannels(1)
      .audioFrequency(44100)
      .format("wav")
      .output(wavPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });

  try {
    // 2. Прочитать wav-файл и получить PCM-данные
    const wav = await fs.readFile(wavPath);
    // WAV PCM начинается с 44 байта заголовка
    const pcm = new Int16Array(
      wav.buffer,
      wav.byteOffset + 44,
      (wav.length - 44) / 2
    );

    // 3. Преобразовать в массив чисел [-1, 1]
    const audioData = Array.from(pcm).map((x) => x / 32768);

    // 4. Определить BPM
    const mt = new MusicTempo(audioData);
    return mt.tempo || null;
  } finally {
    // 5. Удалить временный wav
    await fs.remove(wavPath).catch(() => {
      // Игнорируем ошибки удаления
    });
  }
}
