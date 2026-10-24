import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GPS exports can be a few megabytes; the import action validates the size itself.
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
};

export default nextConfig;
