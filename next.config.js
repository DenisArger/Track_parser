/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  webpack: (config) => {
    config.externals.push({
      "fluent-ffmpeg": "commonjs fluent-ffmpeg",
      aubio: "commonjs aubio",
    });
    return config;
  },
};

module.exports = nextConfig;
