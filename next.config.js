/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules from server-side bundling
  // These packages will be loaded using native require() at runtime
  serverExternalPackages: ["fluent-ffmpeg"],

  // Explicit Turbopack configuration
  // Empty object indicates we're using Turbopack without custom rules
  turbopack: {},

  // Ensure config.json is included in build
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Copy config.json to output directory
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
