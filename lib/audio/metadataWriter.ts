// Dynamic import to avoid issues during static generation
// import NodeID3 from "node-id3";
import { TrackMetadata } from "@/types/track";

/**
 * Записывает метаданные в MP3 файл
 */
export async function writeTrackTags(
  filePath: string,
  metadata: TrackMetadata
): Promise<boolean> {
  // Dynamic import to avoid issues during static generation
  const NodeID3 = (await import("node-id3")).default;
  
  const tags = {
    title: metadata.title,
    artist: metadata.artist,
    performerInfo: metadata.artist,
    originalArtist: metadata.artist,
    album: metadata.album,
    genre: metadata.genre,
    year: metadata.year?.toString(),
    comment: {
      language: "eng",
      text: `Рейтинг: ${metadata.rating}`,
    },
  };

  const result = NodeID3.write(tags, filePath);
  if (result instanceof Error) {
    throw result;
  }
  return result;
}
