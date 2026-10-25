/** @type {import('next').NextConfig} */
const internalApiUrl = (
  process.env.INTERNAL_API_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  // The browser talks to the same origin; Next proxies API traffic to the
  // backend. This avoids CORS and works behind any reverse proxy.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${internalApiUrl}/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api/v1",
  },
};

export default nextConfig;
