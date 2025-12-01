import fs from "fs-extra";
import path from "path";
import {
  isServerlessEnvironment,
  getSafeWorkingDirectory,
} from "@/lib/utils/environment";

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

/**
 * Gets default configuration
 * Used as fallback in serverless environments when config.json is not available
 * Uses default values from config.json structure and only overrides with env vars if present
 */
function getDefaultConfig(): AppConfig {
  // Return default config matching config.json structure
  // Only override with environment variables if they exist
  return {
    folders: {
      downloads: "downloads",
      processed: "processed",
      rejected: "rejected",
      server_upload: "server_upload",
    },
    ftp: {
      host: "",
      port: 21,
      user: "",
      password: "",
      secure: false,
    },
    processing: {
      maxDuration: 360,
      defaultRating: 5,
      defaultYear: 2025,
    },
    audio: {
      bitrate: "192k",
      sampleRate: 44100,
    },
    rapidapi: {
      // Only use env vars if they exist, otherwise empty strings
      key: process.env.RAPIDAPI_KEY || "",
      host: process.env.RAPIDAPI_HOST || "",
    },
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    // Загружаем базовую конфигурацию
    // Use safe working directory for serverless environments
    const workingDir = getSafeWorkingDirectory();
    const configPath = path.join(workingDir, "config.json");

    // Check if config file exists
    if (!(await fs.pathExists(configPath))) {
      // In serverless, try to load from environment variables or use defaults
      if (isServerlessEnvironment()) {
        console.warn(
          "Config file not found in serverless environment, using defaults from env"
        );
        return getDefaultConfig();
      }
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
    // In serverless, we skip directory creation as file system might be read-only
    if (!isServerlessEnvironment()) {
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
    } else {
      console.log("Skipping directory creation in serverless environment");
    }

    return config;
  } catch (error) {
    console.error("Error loading config:", error);
    throw new Error(
      `Failed to load configuration: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  // In serverless, file system might be read-only, so we skip saving
  if (isServerlessEnvironment()) {
    console.warn("Saving config is not supported in serverless environment");
    return;
  }

  try {
    const workingDir = getSafeWorkingDirectory();
    const configPath = path.join(workingDir, "config.json");
    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error("Error saving config:", error);
    // Don't throw - config saving is not critical
  }
}
