/**
 * Скрипт для миграции данных из tracks.json в Supabase Database
 *
 * Использование:
 *   yarn migrate:tracks
 *   или
 *   yarn tsx scripts/migrate-tracks-to-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Track } from "../types/track";
import fs from "fs-extra";
import path from "path";

// Создаем Supabase клиент напрямую (без использования server.ts для избежания проблем с путями)
function createSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function migrateTracks() {
  // Загружаем переменные окружения
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch (e) {
    console.warn(e);
    // dotenv опционален, переменные могут быть установлены в системе
  }

  // Загружаем tracks.json
  const tracksFilePath = path.join(process.cwd(), "tracks.json");

  if (!(await fs.pathExists(tracksFilePath))) {
    console.error("tracks.json not found at:", tracksFilePath);
    process.exit(1);
  }

  const tracksData = await fs.readJson(tracksFilePath);

  if (!Array.isArray(tracksData)) {
    console.error("tracks.json does not contain an array");
    process.exit(1);
  }

  console.log(`Found ${tracksData.length} tracks to migrate`);

  const supabase = createSupabaseClient();

  // Преобразуем треки в формат базы данных
  const tracksToInsert = tracksData.map((track: Track) => ({
    id: track.id,
    filename: track.filename,
    original_path: track.originalPath || null,
    processed_path: track.processedPath || null,
    status: track.status,
    metadata: {
      title: track.metadata.title || "",
      artist: track.metadata.artist || "",
      album: track.metadata.album || "",
      genre: track.metadata.genre || "Средний",
      rating: track.metadata.rating || 0,
      year: track.metadata.year || 0,
      duration: track.metadata.duration,
      bpm: track.metadata.bpm,
      isTrimmed: track.metadata.isTrimmed,
      trimSettings: track.metadata.trimSettings,
      sourceUrl: track.metadata.sourceUrl,
      sourceType: track.metadata.sourceType,
    },
    download_progress: track.downloadProgress ?? null,
    processing_progress: track.processingProgress ?? null,
    upload_progress: track.uploadProgress ?? null,
    error: track.error || null,
  }));

  // Вставляем треки в базу данных (batch insert)
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < tracksToInsert.length; i += batchSize) {
    const batch = tracksToInsert.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from("tracks")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(
          `Migrated batch ${i / batchSize + 1}/${Math.ceil(tracksToInsert.length / batchSize)}: ${batch.length} tracks`,
        );
      }
    } catch (error) {
      console.error(`Exception inserting batch ${i / batchSize + 1}:`, error);
      errorCount += batch.length;
    }
  }

  console.log("\nMigration completed!");
  console.log(`Successfully migrated: ${successCount} tracks`);
  console.log(`Errors: ${errorCount} tracks`);

  if (errorCount === 0) {
    console.log("\n✅ All tracks migrated successfully!");
    console.log(
      "You can now delete tracks.json if you want (make a backup first!)",
    );
  } else {
    console.log("\n⚠️  Some tracks failed to migrate. Check the errors above.");
  }
}

// Запускаем миграцию
migrateTracks().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
