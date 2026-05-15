/**
 * Инвентаризация Supabase Storage.
 *
 * Использование:
 *   yarn tsx scripts/storage-inventory.ts
 */

import { STORAGE_BUCKETS, listStorageInventory } from "@/lib/storage/supabaseStorage";

async function main() {
  try {
    const buckets = [
      STORAGE_BUCKETS.downloads,
      STORAGE_BUCKETS.processed,
      STORAGE_BUCKETS.rejected,
      STORAGE_BUCKETS.previews,
      STORAGE_BUCKETS.serverUpload,
    ] as const;

    const inventory = await listStorageInventory(buckets);
    const totalFiles = inventory.reduce((sum, bucket) => sum + bucket.count, 0);

    console.log(JSON.stringify({ totalFiles, buckets: inventory }, null, 2));
  } catch (error) {
    console.error(
      "Storage inventory failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
