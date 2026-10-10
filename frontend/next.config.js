/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['react-pdf'],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  }
}
module.exports = nextConfig
