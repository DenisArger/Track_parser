/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules from server-side bundling
  // These packages will be loaded using native require() at runtime
  serverExternalPackages: ["fluent-ffmpeg"],

  // Output configuration for Netlify
  output: "standalone",

  // Ensure config.json is included in build
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

  // Experimental features for better serverless support
  experimental: {
    serverComponentsExternalPackages: ["fluent-ffmpeg"],
  },
};

module.exports = nextConfig;
