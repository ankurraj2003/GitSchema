import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    // Only rewrite if we're in development or if a specific backend URL is provided.
    // When deployed on Vercel, we want requests to /api/* to be handled natively.
    if (process.env.NODE_ENV === "production" && !process.env.PYTHON_BACKEND_URL) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.PYTHON_BACKEND_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
