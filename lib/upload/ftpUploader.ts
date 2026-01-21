// Dynamic imports to avoid issues during static generation
// import path from "path";
// import fs from "fs-extra";
import { FtpConfig, TrackMetadata } from "@/types/track";
import { generateSafeFilename } from "@/lib/utils/filenameUtils";

/**
 * Загружает файл на FTP сервер
 */
export async function uploadToFtp(
  filePath: string,
  ftpConfig: FtpConfig,
  metadata?: TrackMetadata,
  trackId?: string
): Promise<void> {
  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");

  console.log("Starting FTP upload...");
  console.log("File path:", filePath);
  console.log("FTP host:", ftpConfig.host);
  console.log("FTP remote path:", ftpConfig.remotePath || "(root)");

  // Проверяем, является ли путь путем в Storage
  const isStoragePath = !filePath.includes(path.sep) || 
                       filePath.startsWith('downloads/') || 
                       filePath.startsWith('processed/') ||
                       filePath.startsWith('rejected/') ||
                       filePath.includes('/');

  let actualFilePath = filePath;
  let tempFilePath: string | null = null;

  if (isStoragePath) {
    // Файл в Storage - скачиваем временно
    try {
      const {
        downloadFileFromStorage,
        STORAGE_BUCKETS,
      } = await import("@/lib/storage/supabaseStorage");
      
      let storageBucket: string = STORAGE_BUCKETS.processed;
      let storagePath = filePath;
      
      if (filePath.startsWith('downloads/')) {
        storageBucket = STORAGE_BUCKETS.downloads;
        storagePath = filePath.replace('downloads/', '');
      } else if (filePath.startsWith('processed/')) {
        storageBucket = STORAGE_BUCKETS.processed;
        storagePath = filePath.replace('processed/', '');
      } else if (filePath.startsWith('rejected/')) {
        storageBucket = STORAGE_BUCKETS.rejected;
        storagePath = filePath.replace('rejected/', '');
      }
      
      let fileBuffer: Buffer;
      try {
        fileBuffer = await downloadFileFromStorage(storageBucket, storagePath);
      } catch (firstErr) {
        if (trackId && storagePath.startsWith(trackId + "_")) {
          const altPath = trackId + "/" + storagePath.slice((trackId + "_").length);
          try {
            fileBuffer = await downloadFileFromStorage(storageBucket, altPath);
          } catch {
            const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
            throw new Error(`Failed to download file from Storage: ${msg}`);
          }
        } else {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          throw new Error(`Failed to download file from Storage: ${msg}`);
        }
      }
      {
        tempFilePath = path.join(
          (await import("@/lib/config").then((m) => m.loadConfig())).folders
            .server_upload,
          `temp_${Date.now()}_${path.basename(filePath)}`
        );
        await fs.ensureDir(path.dirname(tempFilePath));
        await fs.writeFile(tempFilePath, fileBuffer);
        actualFilePath = tempFilePath;
        console.log("Downloaded file from Storage to temp path:", actualFilePath);
      }
    } catch (storageError) {
      console.error("Error downloading from Storage:", storageError);
      throw storageError;
    }
  }

  // Check if file exists
  if (!(await fs.pathExists(actualFilePath))) {
    throw new Error(`File not found: ${actualFilePath}`);
  }

  const fileStats = await fs.stat(actualFilePath);
  console.log("File size:", fileStats.size, "bytes");

  // Dynamic import to avoid issues during static generation
  const { Client } = await import("basic-ftp");
  const client = new Client();

  try {
    console.log("Connecting to FTP server...");
    // Connect to FTP server
    await client.access({
      host: ftpConfig.host,
      port: ftpConfig.port,
      user: ftpConfig.user,
      password: ftpConfig.password,
      secure: ftpConfig.secure,
    });
    console.log("Connected to FTP server successfully");

    // Change to remote directory if specified
    if (ftpConfig.remotePath) {
      // Normalize path (handle Windows paths, preserve absolute paths)
      let remoteDir = ftpConfig.remotePath
        .replace(/\\/g, "/") // Convert Windows separators to forward slashes
        .replace(/\/+/g, "/") // Replace multiple slashes with single slash
        .replace(/\/$/, ""); // Remove trailing slash only

      console.log("Changing to remote directory:", remoteDir);

      if (remoteDir) {
        // Ensure directory exists (create if needed)
        // ensureDir handles both absolute and relative paths correctly
        try {
          await client.ensureDir(remoteDir);
          console.log("Remote directory ensured:", remoteDir);
        } catch (error) {
          console.warn("ensureDir failed, trying cd:", error);
          // If ensureDir fails, try to change to directory (might already exist)
          try {
            await client.cd(remoteDir);
            console.log("Changed to directory:", remoteDir);
          } catch (cdError) {
            const errorMessage =
              cdError instanceof Error ? cdError.message : String(cdError);
            console.error(
              `Could not access or create remote directory: ${remoteDir}`,
              errorMessage
            );
            throw new Error(
              `Failed to access remote directory "${remoteDir}": ${errorMessage}`
            );
          }
        }
      }
    }

    // Use metadata to generate filename, or fallback to basename
    const fileName = metadata
      ? generateSafeFilename(metadata)
      : path.basename(filePath);

    console.log("Uploading file with name:", fileName);
    console.log("Original file path:", filePath);
    if (metadata) {
      console.log("Metadata used for filename:", {
        title: metadata.title,
        artist: metadata.artist,
      });
    }

    // Upload file (actualFilePath — локальный файл или скачанный из Storage во временный)
    await client.uploadFrom(actualFilePath, fileName);

    console.log("File uploaded successfully:", fileName);

    // Verify upload by checking file size on server
    try {
      const remoteFileSize = await client.size(fileName);
      console.log("Remote file size:", remoteFileSize, "bytes");
      if (remoteFileSize !== fileStats.size) {
        console.warn(
          `File size mismatch: local ${fileStats.size}, remote ${remoteFileSize}`
        );
      }
    } catch (sizeError) {
      console.warn("Could not verify file size on server:", sizeError);
      // Don't fail upload if size check fails
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("FTP upload error:", errorMessage);
    throw new Error(`FTP upload failed: ${errorMessage}`);
  } finally {
    try {
      client.close();
      console.log("FTP connection closed");
    } catch (closeError) {
      console.warn("Error closing FTP connection:", closeError);
    }
    
    // Удаляем временный файл если он был создан
    if (tempFilePath && await fs.pathExists(tempFilePath)) {
      try {
        await fs.remove(tempFilePath);
        console.log("Temporary file removed:", tempFilePath);
      } catch (removeError) {
        console.warn("Error removing temporary file:", removeError);
      }
    }
  }
}
