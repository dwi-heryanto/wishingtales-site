import type { NextConfig } from "next";

const config: NextConfig = {
  // Static export: the whole site is HTML on Cloudflare Pages, so Google gets
  // server-rendered markup with no rehydration penalty (D7).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
