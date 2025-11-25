import path from "path";
import { FtpConfig } from "@/types/track";

/**
 * Загружает файл на FTP сервер
 */
export async function uploadToFtp(
  filePath: string,
  ftpConfig: FtpConfig
): Promise<void> {
  const { Client } = require("basic-ftp");
  const client = new Client();

  try {
    await client.access(ftpConfig);
    await client.uploadFrom(filePath, path.basename(filePath));
  } finally {
    client.close();
  }
}
