/**
 * Скрипт для миграции существующих аудио файлов в Supabase Storage
 * 
 * Использование:
 *   yarn migrate:files
 *   или
 *   yarn tsx scripts/migrate-files-to-storage.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs-extra";
import path from "path";

const STORAGE_BUCKETS = {
  downloads: "downloads",
  processed: "processed",
  rejected: "rejected",
  serverUpload: "server-upload",
  previews: "previews",
} as const;

// Создаем Supabase клиент напрямую
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function uploadFileToStorage(
  bucket: string,
  filePath: string,
  file: Buffer,
  options?: {
    contentType?: string;
    upsert?: boolean;
  }
): Promise<{ path: string }> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: options?.contentType || "audio/mpeg",
      upsert: options?.upsert ?? true,
    });

  if (error) {
    throw error;
  }

  return { path: data.path };
}

async function migrateFiles() {
  console.log("Starting migration of audio files to Supabase Storage...");

  // Загружаем переменные окружения
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch (e) {
    // dotenv опционален
  }

  const supabase = createSupabaseClient();
  const workingDir = process.cwd();

  // Папки для миграции
  const folders = [
    { local: "downloads", bucket: STORAGE_BUCKETS.downloads },
    { local: "processed", bucket: STORAGE_BUCKETS.processed },
    { local: "rejected", bucket: STORAGE_BUCKETS.rejected },
  ];

  let totalMigrated = 0;
  let totalErrors = 0;

  for (const folder of folders) {
    const localPath = path.join(workingDir, folder.local);
    
    if (!(await fs.pathExists(localPath))) {
      console.log(`Skipping ${folder.local} (directory does not exist)`);
      continue;
    }

    console.log(`\nMigrating files from ${folder.local}...`);

    const files = await fs.readdir(localPath);
    const mp3Files = files.filter((file) => file.endsWith(".mp3"));

    console.log(`Found ${mp3Files.length} MP3 files in ${folder.local}`);

    for (const file of mp3Files) {
      const filePath = path.join(localPath, file);
      
      try {
        const fileBuffer = await fs.readFile(filePath);
        const storagePath = file; // Используем имя файла как путь в Storage

        await uploadFileToStorage(folder.bucket, storagePath, fileBuffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });

        console.log(`  ✅ Migrated: ${file}`);
        totalMigrated++;

        // Опционально: удалить локальный файл после успешной миграции
        // Раскомментируйте следующую строку, если хотите удалить файлы после миграции
        // await fs.remove(filePath);
      } catch (error) {
        console.error(`  ❌ Error migrating ${file}:`, error);
        totalErrors++;
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Migration completed!");
  console.log(`Successfully migrated: ${totalMigrated} files`);
  console.log(`Errors: ${totalErrors} files`);
  
  if (totalErrors === 0) {
    console.log("\n✅ All files migrated successfully!");
  } else {
    console.log("\n⚠️  Some files failed to migrate. Check the errors above.");
  }
}

// Запускаем миграцию
migrateFiles().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
