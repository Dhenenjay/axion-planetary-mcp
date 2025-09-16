import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during build to avoid configuration issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Continue build even with TypeScript errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
