/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  typescript: {
    // TODO: Fix type conflicts between core/types and implementations
    // Main issues: NodeConfig, EdgeConfig interface duplications
    ignoreBuildErrors: true,
  },
  eslint: {
    // TODO: Set up proper ESLint configuration
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Vercel optimizations
  images: {
    unoptimized: false,
    domains: [],
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
