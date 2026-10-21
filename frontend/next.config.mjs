import withSerwistInit from "@serwist/next";

const backend = process.env.BACKEND_URL ?? "http://localhost:4000";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/", revision: "shell-v1" },
    { url: "/history", revision: "shell-v1" },
    { url: "/login", revision: "shell-v1" },
    { url: "/desktop/connect", revision: "desktop-v1" },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
    ];
  },
};

export default withSerwist(nextConfig);
