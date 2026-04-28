import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Chat streaming + auth use Node APIs (jose, openai SDK). Keep routes on
    // the Node runtime by default; switch individual routes to 'edge' if
    // they don't need Node.
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default nextConfig;
