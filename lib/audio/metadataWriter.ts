import NodeID3 from "node-id3";
import { TrackMetadata } from "@/types/track";

/**
 * Записывает метаданные в MP3 файл
 */
export async function writeTrackTags(
  filePath: string,
  metadata: TrackMetadata
): Promise<boolean> {
  const tags = {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    genre: metadata.genre,
    year: metadata.year?.toString(),
    comment: {
      language: "eng",
      text: `Рейтинг: ${metadata.rating}`,
    },
  };

  return NodeID3.write(tags, filePath);
}
