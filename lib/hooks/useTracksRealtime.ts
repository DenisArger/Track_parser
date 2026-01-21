"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Track } from "@/types/track";

/**
 * React хук для подписки на изменения треков в реальном времени
 */
export function useTracksRealtime(
  onUpdate?: (track: Track) => void,
  onInsert?: (track: Track) => void,
  onDelete?: (trackId: string) => void
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Подписка на изменения в таблице tracks
    const channel = supabase
      .channel("tracks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracks",
        },
        (payload) => {
          console.log("Track change received:", payload);

          if (payload.eventType === "UPDATE" && payload.new) {
            // Преобразуем данные из базы в формат Track
            const track = mapRowToTrack(payload.new as any);
            onUpdate?.(track);
          } else if (payload.eventType === "INSERT" && payload.new) {
            const track = mapRowToTrack(payload.new as any);
            onInsert?.(track);
          } else if (payload.eventType === "DELETE" && payload.old) {
            onDelete?.(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate, onInsert, onDelete]);

  return { isConnected };
}

/**
 * Преобразует строку базы данных в Track
 */
function mapRowToTrack(row: any): Track {
  return {
    id: row.id,
    filename: row.filename,
    originalPath: row.original_path || "",
    processedPath: row.processed_path || undefined,
    metadata: {
      title: row.metadata?.title || "",
      artist: row.metadata?.artist || "",
      album: row.metadata?.album || "",
      genre: row.metadata?.genre || "Средний",
      rating: row.metadata?.rating || 0,
      year: row.metadata?.year || 0,
      duration: row.metadata?.duration,
      bpm: row.metadata?.bpm,
      isTrimmed: row.metadata?.isTrimmed,
      trimSettings: row.metadata?.trimSettings,
      sourceUrl: row.metadata?.sourceUrl,
      sourceType: row.metadata?.sourceType,
    },
    status: row.status,
    downloadProgress: row.download_progress ?? undefined,
    processingProgress: row.processing_progress ?? undefined,
    uploadProgress: row.upload_progress ?? undefined,
    error: row.error || undefined,
  };
}

/**
 * Хук для подписки на изменения конкретного трека
 */
export function useTrackRealtime(
  trackId: string,
  onUpdate?: (track: Track) => void
) {
  const [track, setTrack] = useState<Track | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!trackId) return;

    const channel = supabase
      .channel(`track-${trackId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tracks",
          filter: `id=eq.${trackId}`,
        },
        (payload) => {
          if (payload.new) {
            const updatedTrack = mapRowToTrack(payload.new as any);
            setTrack(updatedTrack);
            onUpdate?.(updatedTrack);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackId, onUpdate]);

  return { track, isConnected };
}
