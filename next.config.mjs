/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for Electron production build
  output: 'standalone',
  // Configure webpack to handle @xenova/transformers properly
  webpack: (config) => {
    // Prevent server-side loading of onnxruntime-node
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": false,
    };
    return config;
  },
  // Transpile the transformers package
  transpilePackages: ["@xenova/transformers"],
};
export default nextConfig;
