import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  // Pin the project root so a stray package-lock.json in a parent folder
  // (e.g. your home directory) isn't mistaken for the workspace root.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
