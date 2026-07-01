/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bundle the workspace packages (they ship TS/ESM).
  transpilePackages: ["@blaze-ignite/shared", "@blaze-ignite/db"],
};

export default nextConfig;
