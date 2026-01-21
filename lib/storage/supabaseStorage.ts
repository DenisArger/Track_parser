import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Делает имя файла безопасным для ключа в Supabase Storage:
 * только [a-zA-Z0-9._-]. Кириллица, пробелы и прочие символы заменяются на _.
 */
export function sanitizeFilenameForStorage(name: string): string {
  const s = name || "audio";
  const i = s.lastIndexOf(".");
  const base = i >= 0 ? s.slice(0, i) : s;
  const ext =
    i >= 0 && i < s.length - 1 ? s.slice(i) : ".mp3";
  let out = base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!out) out = "audio";
  return out + ext;
}

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  downloads: "downloads",
  processed: "processed",
  rejected: "rejected",
  serverUpload: "server-upload",
  previews: "previews",
} as const;

/**
 * Проверяет, является ли путь путём в Storage (а не локальным).
 * Локальные: абсолютные (/ или C:\).
 */
export function isStoragePath(p: string): boolean {
  if (!p) return false;
  return !p.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(p);
}

/**
 * Возвращает bucket для originalPath в зависимости от status.
 * rejected → rejected, иначе → downloads.
 */
export function getBucketForOriginalPath(
  status: string
): (typeof STORAGE_BUCKETS)["downloads"] | (typeof STORAGE_BUCKETS)["rejected"] {
  return status === "rejected"
    ? STORAGE_BUCKETS.rejected
    : STORAGE_BUCKETS.downloads;
}

/**
 * Загружает файл в Supabase Storage
 */
export async function uploadFileToStorage(
  bucket: string,
  path: string,
  file: Buffer | Uint8Array,
  options?: {
    contentType?: string;
    upsert?: boolean;
  }
): Promise<{ path: string; publicUrl?: string }> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: options?.contentType || "audio/mpeg",
      upsert: options?.upsert ?? true,
    });

  if (error) {
    console.error(`Error uploading file to ${bucket}/${path}:`, error);
    throw error;
  }

  // Получаем public URL если bucket публичный
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Создает signed URL для файла в Storage
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error(`Error creating signed URL for ${bucket}/${path}:`, error);
    throw error;
  }

  return data.signedUrl;
}

/**
 * Скачивает файл из Supabase Storage
 */
export async function downloadFileFromStorage(
  bucket: string,
  path: string
): Promise<Buffer> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error) {
    console.error(`Error downloading file from ${bucket}/${path}:`, error);
    throw error;
  }

  // Преобразуем Blob в Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Удаляет файл из Supabase Storage
 */
export async function deleteFileFromStorage(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.error(`Error deleting file from ${bucket}/${path}:`, error);
    throw error;
  }
}

/**
 * Проверяет существование файла в Storage
 */
export async function fileExistsInStorage(
  bucket: string,
  path: string
): Promise<boolean> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path.split("/").slice(0, -1).join("/") || "", {
      limit: 1000,
    });

  if (error) {
    return false;
  }

  const fileName = path.split("/").pop();
  return data?.some((file) => file.name === fileName) ?? false;
}

/**
 * Получает public URL для файла (если bucket публичный)
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = createSupabaseServerClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Рекурсивно собирает пути всех файлов в bucket (в префиксе).
 */
async function listAllPaths(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    const { data: sub } = await supabase.storage
      .from(bucket)
      .list(path, { limit: 1 });
    const isFolder = sub && sub.length > 0;
    if (isFolder) {
      paths.push(...(await listAllPaths(supabase, bucket, path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

/**
 * Очищает все файлы в bucket.
 */
export async function clearBucket(bucket: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  const paths = await listAllPaths(supabase, bucket, "");
  if (paths.length === 0) return 0;
  const batch = 500;
  for (let i = 0; i < paths.length; i += batch) {
    const chunk = paths.slice(i, i + batch);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) throw error;
  }
  return paths.length;
}
