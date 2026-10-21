import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

const backend = process.env.BACKEND_URL ?? "http://localhost:4000";
// A constant shell revision keeps old HTML after deployment while its hashed chunks change.
const shellRevision = process.env.DAYFLOW_BUILD_REVISION ?? randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/", revision: shellRevision },
    { url: "/history", revision: shellRevision },
    { url: "/login", revision: shellRevision },
    { url: "/desktop/connect", revision: shellRevision },
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
