import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
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
