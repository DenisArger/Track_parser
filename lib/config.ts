import fs from "fs-extra";
import path from "path";

// Загружаем переменные окружения (Next.js автоматически загружает .env, но для серверной части используем dotenv)
// Safe for production - dotenv.config() is safe to call multiple times
if (typeof window === "undefined") {
  try {
    require("dotenv").config();
  } catch (error) {
    // dotenv is optional - Next.js handles .env files automatically
    // This is just a fallback for server-side code
    console.log("dotenv not available or .env file not found (this is OK)");
  }
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
  try {
    // Загружаем базовую конфигурацию
    const configPath = path.join(process.cwd(), "config.json");
    
    // Check if config file exists
    if (!(await fs.pathExists(configPath))) {
      throw new Error(`Config file not found at ${configPath}`);
    }
    
    const config = await fs.readJson(configPath);

    // Обновляем конфигурацию из переменных окружения
    if (process.env.RAPIDAPI_KEY) {
      config.rapidapi.key = process.env.RAPIDAPI_KEY;
    }
    if (process.env.RAPIDAPI_HOST) {
      config.rapidapi.host = process.env.RAPIDAPI_HOST;
    }

    // Создаем папки, если они не существуют (with error handling)
    try {
      await fs.ensureDir(config.folders.downloads);
    } catch (error) {
      console.warn("Error creating downloads directory:", error);
    }
    
    try {
      await fs.ensureDir(config.folders.processed);
    } catch (error) {
      console.warn("Error creating processed directory:", error);
    }
    
    try {
      await fs.ensureDir(config.folders.rejected);
    } catch (error) {
      console.warn("Error creating rejected directory:", error);
    }
    
    try {
      await fs.ensureDir(config.folders.server_upload);
    } catch (error) {
      console.warn("Error creating server_upload directory:", error);
    }

    return config;
  } catch (error) {
    console.error("Error loading config:", error);
    throw new Error(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const configPath = path.join(process.cwd(), "config.json");
  await fs.writeJson(configPath, config, { spaces: 2 });
}
