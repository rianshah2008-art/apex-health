import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Cursor automation browser hits 127.0.0.1 rather than localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
