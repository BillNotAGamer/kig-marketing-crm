import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-src 'self' https://drive.google.com https://docs.google.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
