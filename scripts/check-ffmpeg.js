const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔍 Checking FFmpeg installation...");

exec("ffmpeg -version", (error, stdout, stderr) => {
  if (error) {
    console.error("❌ FFmpeg is not installed or not found in PATH");
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
    console.log("✅ FFmpeg is installed");
    console.log("Version:", stdout.split("\n")[0]);
  }
});

// Check if required directories exist
const requiredDirs = ["downloads", "processed", "rejected", "server_upload"];

console.log("\n📁 Checking required directories...");

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log(`✅ Directory exists: ${dir}`);
  }
});

console.log("\n🎉 Environment check completed!");
console.log('Run "yarn dev" to start the application');
