import fs from "fs-extra";
import path from "path";

// Загружаем переменные окружения (Next.js автоматически загружает .env, но для серверной части используем dotenv)
if (typeof window === "undefined") {
  require("dotenv").config();
}

export interface AppConfig {
  folders: {
    downloads: string;
    processed: string;
    rejected: string;
    server_upload: string;
  };
  ftp: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  };
  processing: {
    maxDuration: number;
    defaultRating: number;
    defaultYear: number;
  };
  audio: {
    bitrate: string;
    sampleRate: number;
  };
  rapidapi: {
    key: string;
    host: string;
  };
}

export async function loadConfig(): Promise<AppConfig> {
  // Загружаем базовую конфигурацию
  const configPath = path.join(process.cwd(), "config.json");
  const config = await fs.readJson(configPath);

  // Обновляем конфигурацию из переменных окружения
  if (process.env.RAPIDAPI_KEY) {
    config.rapidapi.key = process.env.RAPIDAPI_KEY;
  }
  if (process.env.RAPIDAPI_HOST) {
    config.rapidapi.host = process.env.RAPIDAPI_HOST;
  }

  // Создаем папки, если они не существуют
  await fs.ensureDir(config.folders.downloads);
  await fs.ensureDir(config.folders.processed);
  await fs.ensureDir(config.folders.rejected);
  await fs.ensureDir(config.folders.server_upload);

  return config;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const configPath = path.join(process.cwd(), "config.json");
  await fs.writeJson(configPath, config, { spaces: 2 });
}
