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
  resolveCatalogFolderName,
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

async function listAll(client: Client, dir: string) {
  return client.list(dir);
}

async function listDir(client: Client, dir: string): Promise<string[]> {
  const infos = await client.list(dir);
  return infos
    .filter((i) => i.isFile && AUDIO_EXT.test(i.name))
    .map((i) => i.name);
}

export async function fetchCatalogs(
  ftpConfig: FtpConfig,
  target: TargetMonth,
): Promise<RemoteCatalog[]> {
  const root = (ftpConfig.remotePath || "").replace(/\/+$/, "") || "/";
  const client = await connect(ftpConfig);
  try {
    const all = await listAll(client, root);
    // Надёжно: некоторые FTP-серверы неверно помечают isDirectory.
    const dirNames = all.filter((i) => i.isDirectory).map((i) => i.name);
    const allNames = all.map((i) => i.name);
    const result: RemoteCatalog[] = [];
    for (const profile of CATALOGS) {
      const folderName =
        resolveCatalogFolderName(dirNames, profile, target) ??
        resolveCatalogFolderName(allNames, profile, target);
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
