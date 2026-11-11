import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image uses the "standalone" output (a minimal server + only the dependencies it needs).
  // Off outside Docker so a plain `npm start` keeps working normally.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  serverExternalPackages: ["pg"],
  // The teacher's "Kurikulum" page became "Materi".
  async redirects() {
    return [
      { source: "/guru/kurikulum", destination: "/guru/materi", permanent: true },
      { source: "/guru/kurikulum/:slug", destination: "/guru/materi/partitur/:slug", permanent: true },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
