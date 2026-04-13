import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.NODE_ENV === "development"
          ? "http://localhost:8000/api/:path*"
          : "/api/",
      },
    ];
  },
};

export default nextConfig;
