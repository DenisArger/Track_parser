import fs from "fs-extra";
import path from "path";

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

  // Загружаем переменные окружения из .env
  const envPath = path.join(process.cwd(), ".env");
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, "utf-8");
    const envVars: Record<string, string> = {};

    envContent.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });

    // Обновляем конфигурацию из переменных окружения
    if (envVars.RAPIDAPI_KEY) {
      config.rapidapi.key = envVars.RAPIDAPI_KEY;
    }
    if (envVars.RAPIDAPI_HOST) {
      config.rapidapi.host = envVars.RAPIDAPI_HOST;
    }
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

export function getConfig(): AppConfig {
  // This function is no longer needed as config is loaded directly in loadConfig
  // Keeping it for now to avoid breaking existing calls, but it will always throw
  // an error unless loadConfig is called first.
  throw new Error("Configuration not loaded. Call loadConfig() first.");
}
