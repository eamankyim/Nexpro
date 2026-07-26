import type { NextConfig } from "next";

/** Local ABS backend (macOS AirPlay often occupies :5000; :5001 may be other tools). */
const ABS_API_ORIGIN = (
  process.env.ABS_API_ORIGIN ||
  process.env.NEXT_PUBLIC_ABS_API_ORIGIN ||
  "http://127.0.0.1:5002"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${ABS_API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
