/**
 * Работа с каталогами поверх FTP: чтение списков файлов и отправка готовых M3U.
 *
 * Используется вкладкой «Месячные рубрики» — Next.js-сервер по FTP читает
 * папку /Server_1, парсит имена треков движком и отправляет собранные
 * плейлисты обратно на сервер существующим FTP-клиентом.
 */

import { Client } from "basic-ftp";
import { FtpConfig } from "@/types/track";
import { CATALOGS, CatalogProfile } from "./catalogs";
import {
  buildCatalogPlaylistFromFiles,
  CatalogResult,
  TargetMonth,
} from "./playlistBuilder";

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;

export interface RemoteCatalog {
  profile: CatalogProfile;
  folderLabel: string | null;
  files: string[];
}

async function connect(ftpConfig: FtpConfig): Promise<Client> {
  const client = new Client();
  await client.access({
    host: ftpConfig.host,
    port: ftpConfig.port || 21,
    user: ftpConfig.user,
    password: ftpConfig.password,
    secure: ftpConfig.secure,
  });
  return client;
}

function resolveFolderName(
  dirs: string[],
  profile: CatalogProfile,
  target: TargetMonth,
): string | null {
  const filled = profile.folder
    .replace("{MM}", String(target.month).padStart(2, "0"))
    .replace("{YYYY}", String(target.year));
  if (dirs.includes(filled)) return filled;
  const kw = profile.matchKeyword.toLowerCase();
  return dirs.find((n) => n.toLowerCase().includes(kw)) ?? null;
}

async function listDir(client: Client, dir: string): Promise<string[]> {
  const infos = await client.list(dir);
  return infos
    .filter((i) => i.isFile && AUDIO_EXT.test(i.name))
    .map((i) => i.name);
}

async function listSubdirs(client: Client, dir: string): Promise<string[]> {
  const infos = await client.list(dir);
  return infos.filter((i) => i.isDirectory).map((i) => i.name);
}

export async function fetchCatalogs(
  ftpConfig: FtpConfig,
  target: TargetMonth,
): Promise<RemoteCatalog[]> {
  const root = (ftpConfig.remotePath || "").replace(/\/+$/, "") || "/";
  const client = await connect(ftpConfig);
  try {
    const dirs = await listSubdirs(client, root);
    const result: RemoteCatalog[] = [];
    for (const profile of CATALOGS) {
      const folderName = resolveFolderName(dirs, profile, target);
      if (!folderName) {
        result.push({ profile, folderLabel: null, files: [] });
        continue;
      }
      const folderPath = `${root}/${folderName}`.replace(/\/+/g, "/");
      const files = await listDir(client, folderPath);
      result.push({ profile, folderLabel: folderPath, files });
    }
    return result;
  } finally {
    client.close();
  }
}

export async function buildCatalogsOverFtp(
  ftpConfig: FtpConfig,
  target: TargetMonth,
): Promise<CatalogResult[]> {
  const remote = await fetchCatalogs(ftpConfig, target);
  return remote.map((rc) =>
    buildCatalogPlaylistFromFiles(
      rc.files,
      rc.folderLabel,
      rc.profile,
      target,
    ),
  );
}

function safeName(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Записывает M3U во временный файл с нужным именем и отправляет на сервер
 * через существующий FTP-клиент (uploadToFtp). remotePath в ftpConfig
 * считается целевой папкой на сервере.
 */
export async function sendM3uViaFtp(
  ftpConfig: FtpConfig,
  fileName: string,
  content: string,
): Promise<void> {
  const fs = await import("fs-extra");
  const path = await import("path");
  const os = await import("os");
  const tmp = path.join(os.tmpdir(), safeName(fileName));
  await fs.writeFile(tmp, content, "utf8");
  try {
    const { uploadToFtp } = await import("@/lib/upload/ftpUploader");
    await uploadToFtp(tmp, ftpConfig);
  } finally {
    await fs.remove(tmp).catch(() => undefined);
  }
}
