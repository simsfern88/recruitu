import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "pg", "pdfkit", "pdfjs-dist"],
};

export default nextConfig;
