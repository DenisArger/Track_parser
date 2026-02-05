/**
 * Sync ratings from mp3tag.csv into radio_tracks.rating.
 *
 * Usage:
 *   yarn tsx scripts/sync-mp3tag-rating.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs-extra";
import path from "path";
import {
  generateSafeFilename,
  normalizeForMatch,
} from "../lib/utils/filenameUtils";

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

function parseDelimited(content: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = i + 1 < content.length ? content[i + 1] : "";

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function parseRating(value: string | undefined): number | null {
  const s = (value || "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

async function run() {
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch {
    // optional
  }

  const csvPath = path.join(process.cwd(), "mp3tag.csv");
  if (!(await fs.pathExists(csvPath))) {
    throw new Error(`mp3tag.csv not found at: ${csvPath}`);
  }

  const fileBuffer = await fs.readFile(csvPath);
  let content = fileBuffer.toString("utf8");
  if (content.includes("\u0000")) {
    content = fileBuffer.toString("utf16le");
  }
  const rows = parseDelimited(content, ";");
  if (rows.length === 0) {
    throw new Error("mp3tag.csv is empty");
  }

  const headers = rows[0].map((h) =>
    h.replace(/^\uFEFF/, "").trim(),
  );
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = h.toLowerCase();
    if (!headerIndex.has(key)) headerIndex.set(key, i);
  });
  const dataRows = rows.slice(1);

  const idxTitle = headerIndex.get("title") ?? -1;
  const idxArtist = headerIndex.get("artist") ?? -1;
  const idxTrack = headerIndex.get("track") ?? -1;
  const idxFilename = headerIndex.get("filename") ?? -1;

  if (idxTrack === -1) {
    console.error("Parsed headers:", headers);
    console.error("Header map keys:", Array.from(headerIndex.keys()));
    throw new Error("Track column not found in mp3tag.csv");
  }

  const ratingByName = new Map<string, number>();
  let totalRows = 0;
  let rowsWithRating = 0;
  let rowsWithFilename = 0;
  let rowsWithGenerated = 0;
  let duplicates = 0;

  for (const row of dataRows) {
    totalRows += 1;
    const rating = parseRating(row[idxTrack]);
    if (rating === null) continue;
    rowsWithRating += 1;

    let filename = idxFilename >= 0 ? (row[idxFilename] || "").trim() : "";
    if (filename) {
      rowsWithFilename += 1;
    } else {
      const title = idxTitle >= 0 ? (row[idxTitle] || "").trim() : "";
      const artist = idxArtist >= 0 ? (row[idxArtist] || "").trim() : "";
      if (title || artist) {
        filename = generateSafeFilename({ title, artist });
        rowsWithGenerated += 1;
      }
    }

    const normalized = normalizeForMatch(filename || "");
    if (!normalized) continue;
    if (ratingByName.has(normalized)) duplicates += 1;
    ratingByName.set(normalized, rating);
  }

  console.log("Rows total:", totalRows);
  console.log("Rows with rating:", rowsWithRating);
  console.log("Rows with filename:", rowsWithFilename);
  console.log("Rows with generated filename:", rowsWithGenerated);
  console.log("Unique normalized names:", ratingByName.size);
  console.log("Duplicate normalized names:", duplicates);

  const updates = Array.from(ratingByName.entries()).map(
    ([normalizedName, rating]) => ({
      normalized_name: normalizedName,
      rating,
    }),
  );

  if (updates.length === 0) {
    console.log("No ratings to sync.");
    return;
  }

  const supabase = createSupabaseClient();
  const batchSize = 500;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error } = await supabase
      .from("radio_tracks")
      .upsert(batch, { onConflict: "normalized_name" });

    if (error) {
      failed += batch.length;
      console.error(
        `Batch ${i / batchSize + 1} failed (${batch.length} rows):`,
        error,
      );
    } else {
      success += batch.length;
      console.log(
        `Synced batch ${i / batchSize + 1}/${Math.ceil(
          updates.length / batchSize,
        )}: ${batch.length}`,
      );
    }
  }

  console.log("Done. Synced:", success, "Failed:", failed);
}

run().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
