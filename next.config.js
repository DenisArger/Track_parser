/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push({
      "fluent-ffmpeg": "commonjs fluent-ffmpeg",
      aubio: "commonjs aubio",
    });
    return config;
  },
};

module.exports = nextConfig;
