// Dynamic imports to avoid issues during static generation
// These modules are only imported when needed, not at module load time
// import fs from "fs-extra";
// import path from "path";
// import {
//   isServerlessEnvironment,
//   getSafeWorkingDirectory,
// } from "@/lib/utils/environment";

// Загружаем переменные окружения (Next.js автоматически загружает .env, но для серверной части используем dotenv)
// Safe for production - dotenv.config() is safe to call multiple times
// Wrapped in try-catch to prevent any errors during module import
if (typeof window === "undefined" && typeof process !== "undefined") {
  try {
    // Use dynamic require to avoid issues if dotenv is not available
    const dotenv = require("dotenv");
    if (dotenv && typeof dotenv.config === "function") {
      dotenv.config();
    }
  } catch (error) {
    // dotenv is optional - Next.js handles .env files automatically
    // This is just a fallback for server-side code
    // Silently ignore - this is expected in many environments
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
    remotePath?: string;
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
  ffmpeg?: {
    path?: string; // Optional path to FFmpeg directory
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
      host: process.env.FTP_HOST || "",
      port: process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21,
      user: process.env.FTP_USER || "",
      password: process.env.FTP_PASSWORD || "",
      secure: process.env.FTP_SECURE === "true",
      remotePath: process.env.FTP_REMOTE_PATH || undefined,
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
    ffmpeg: {
      path: process.env.FFMPEG_PATH || undefined,
    },
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    // Dynamic imports to avoid issues during static generation
    const fs = await import("fs-extra");
    const path = await import("path");
    const { isServerlessEnvironment, getSafeWorkingDirectory } = await import(
      "@/lib/utils/environment"
    );

    // Check if we're in a build-time environment
    if (
      typeof process !== "undefined" &&
      process.env.NEXT_PHASE === "phase-production-build"
    ) {
      console.log("Build time detected, returning default config");
      return getDefaultConfig();
    }

    // Загружаем базовую конфигурацию
    // Use safe working directory for serverless environments
    const workingDir = getSafeWorkingDirectory();
    const configPath = path.join(workingDir, "config.json");

    // Check if config file exists
    let configExists = false;
    try {
      configExists = await fs.pathExists(configPath);
    } catch (error) {
      // If we can't check file existence, assume it doesn't exist
      console.warn("Error checking config file existence:", error);
      configExists = false;
    }

    if (!configExists) {
      // In serverless or if file doesn't exist, use defaults
      console.warn(
        `Config file not found at ${configPath}, using defaults${
          isServerlessEnvironment() ? " (serverless)" : ""
        }`
      );
      return getDefaultConfig();
    }

    let configData: any;
    try {
      configData = await fs.readJson(configPath);
    } catch (error) {
      // If we can't read config file, use defaults
      console.warn("Error reading config file, using defaults:", error);
      return getDefaultConfig();
    }

    // Build config object, always using environment variables for FTP
    const config: AppConfig = {
      folders: configData.folders || getDefaultConfig().folders,
      ftp: {
        // FTP settings always from environment variables, never from config.json
        host: process.env.FTP_HOST || "",
        port: process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21,
        user: process.env.FTP_USER || "",
        password: process.env.FTP_PASSWORD || "",
        secure: process.env.FTP_SECURE === "true",
        remotePath: process.env.FTP_REMOTE_PATH || undefined,
      },
      processing: configData.processing || getDefaultConfig().processing,
      audio: configData.audio || getDefaultConfig().audio,
      rapidapi: {
        key: process.env.RAPIDAPI_KEY || configData.rapidapi?.key || "",
        host: process.env.RAPIDAPI_HOST || configData.rapidapi?.host || "",
      },
      ffmpeg: {
        path: process.env.FFMPEG_PATH || configData.ffmpeg?.path || undefined,
      },
    };

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
    // Never throw - always return default config to prevent Server Component errors
    console.error("Error loading config, using defaults:", error);
    return getDefaultConfig();
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    // Dynamic imports to avoid issues during static generation
    const fs = await import("fs-extra");
    const path = await import("path");
    const { isServerlessEnvironment, getSafeWorkingDirectory } = await import(
      "@/lib/utils/environment"
    );

    // In serverless, file system might be read-only, so we skip saving
    if (isServerlessEnvironment()) {
      console.warn("Saving config is not supported in serverless environment");
      return;
    }

    const workingDir = getSafeWorkingDirectory();
    const configPath = path.join(workingDir, "config.json");
    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error("Error saving config:", error);
    // Don't throw - config saving is not critical
  }
}
