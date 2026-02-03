/* eslint-disable @typescript-eslint/no-require-imports */
const { exec } = require("child_process");
const fs = require("fs");

console.warn("Checking FFmpeg installation...");

exec("ffmpeg -version", (error, stdout, _stderr) => {
  if (error) {
    console.error("FFmpeg is not installed or not found in PATH");
    console.error("Please install FFmpeg:");
    console.error("");
    console.error("Windows:");
    console.error("1. Download from https://ffmpeg.org/download.html");
    console.error("2. Extract to C:\\ffmpeg");
    console.error("3. Add C:\\ffmpeg\\bin to PATH");
    console.error("");
    console.error("macOS:");
    console.error("brew install ffmpeg");
    console.error("");
    console.error("Linux:");
    console.error("sudo apt update && sudo apt install ffmpeg");
    process.exit(1);
  } else {
    console.warn("FFmpeg is installed");
    console.warn("Version:", stdout.split("\n")[0]);
  }
});

// Check if required directories exist
const requiredDirs = ["downloads", "processed", "rejected", "server_upload"];

console.warn("Checking required directories...");

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.warn(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.warn(`Directory exists: ${dir}`);
  }
});

console.warn("Environment check completed!");
console.warn('Run "yarn dev" to start the application');
