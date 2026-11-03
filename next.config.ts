import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image uses the "standalone" output (a minimal server + only the dependencies it needs).
  // Off outside Docker so a plain `npm start` keeps working normally.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
