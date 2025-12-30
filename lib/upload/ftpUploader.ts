// Dynamic imports to avoid issues during static generation
// import path from "path";
// import fs from "fs-extra";
import { FtpConfig, TrackMetadata } from "@/types/track";

/**
 * Генерирует безопасное имя файла из метаданных трека
 * Формат: "Artist - Title.mp3"
 */
function generateSafeFilename(metadata: TrackMetadata): string {
  // Создаем имя файла в формате "Artist - Title"
  let filename = "";

  // Сначала добавляем артиста
  if (metadata.artist && metadata.artist !== "Unknown") {
    filename = metadata.artist.trim();
  }

  // Затем добавляем тире и название
  if (metadata.title) {
    const title = metadata.title.trim();
    if (title) {
      if (filename) {
        filename += " - " + title;
      } else {
        filename = title;
      }
    }
  }

  // Если нет ни title, ни artist, используем "Unknown"
  if (!filename || filename.trim() === "") {
    filename = "Unknown";
  }

  // Очищаем имя файла от недопустимых символов для файловой системы
  // Заменяем недопустимые символы на пробелы
  filename = filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ") // Заменяем недопустимые символы на пробелы
    .replace(/\s+/g, " ") // Множественные пробелы заменяем на один
    .trim();

  // Ограничиваем длину имени файла (оставляем место для расширения)
  if (filename.length > 200) {
    filename = filename.substring(0, 200).trim();
  }

  // Если после очистки имя пустое, используем "Unknown"
  if (!filename || filename === "") {
    filename = "Unknown";
  }

  // Добавляем расширение
  return `${filename}.mp3`;
}

/**
 * Загружает файл на FTP сервер
 */
export async function uploadToFtp(
  filePath: string,
  ftpConfig: FtpConfig,
  metadata?: TrackMetadata
): Promise<void> {
  // Dynamic imports to avoid issues during static generation
  const fs = await import("fs-extra");
  const path = await import("path");

  console.log("Starting FTP upload...");
  console.log("File path:", filePath);
  console.log("FTP host:", ftpConfig.host);
  console.log("FTP remote path:", ftpConfig.remotePath || "(root)");

  // Check if file exists
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStats = await fs.stat(filePath);
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

    // Upload file
    await client.uploadFrom(filePath, fileName);

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
  }
}
