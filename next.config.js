/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules from server-side bundling
  // These packages will be loaded using native require() at runtime
  serverExternalPackages: ["fluent-ffmpeg"],

  // Explicit Turbopack configuration
  // Empty object indicates we're using Turbopack without custom rules
  turbopack: {},
};

module.exports = nextConfig;
