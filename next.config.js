/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules from server-side bundling
  // These packages will be loaded using native require() at runtime
  serverExternalPackages: [
    "fluent-ffmpeg",
    "node-id3",
    "music-tempo",
    "basic-ftp",
    "fs-extra",
  ],

  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  // Empty object to silence the warning and use default Turbopack behavior
  turbopack: {},

  // Webpack configuration for compatibility (only used if webpack flag is explicitly set)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude binary files from server bundle (not needed in serverless)
      config.externals = config.externals || [];
      config.externals.push({
        "child_process": "commonjs child_process",
      });
    }
    return config;
  },

  // Exclude unnecessary files from standalone output
  outputFileTracingExcludes: {
    "*": [
      "bin/**/*",
      "downloads/**/*",
      "processed/**/*",
      "rejected/**/*",
      "server_upload/**/*",
      "temp/**/*",
    ],
  },

  // Ensure Server Actions work correctly in serverless environments
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

module.exports = nextConfig;
