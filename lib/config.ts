import fs from "fs-extra";
import path from "path";
import { AppConfig } from "@/types/track";

let config: AppConfig;

export async function loadConfig(): Promise<AppConfig> {
  if (config) {
    return config;
  }

  try {
    const configPath = path.join(process.cwd(), "config.json");
    const configData = await fs.readJson(configPath);

    // Ensure all required folders exist
    const folders = configData.folders;
    for (const [key, folderPath] of Object.entries(folders)) {
      await fs.ensureDir(folderPath as string);
    }

    config = configData as AppConfig;
    return config;
  } catch (error) {
    console.error("Error loading config:", error);
    throw new Error("Failed to load configuration");
  }
}

export async function saveConfig(newConfig: Partial<AppConfig>): Promise<void> {
  try {
    const configPath = path.join(process.cwd(), "config.json");
    const currentConfig = await loadConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };

    await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
    config = updatedConfig;
  } catch (error) {
    console.error("Error saving config:", error);
    throw new Error("Failed to save configuration");
  }
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error("Configuration not loaded. Call loadConfig() first.");
  }
  return config;
}
