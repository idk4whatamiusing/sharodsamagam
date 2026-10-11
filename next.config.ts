import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure static output: every page is prerendered at build time from the
  // mirror/*.html fragments + data/*.json, then uploaded to Cloudflare
  // Workers Static Assets. No Node runtime, no server bundle.
  output: "export",

  // Cloudflare Workers Static Assets resolves /foo -> foo/index.html.
  trailingSlash: true,

  // next/image isn't used, but keep this off so nothing gets rewritten to
  // /_next/image which does not exist in a static export.
  images: { unoptimized: true },

  // Emit /page.html + /page/index.html so both extensionless and trailing
  // slash URLs resolve regardless of how a visitor bookmarks a link.
  generateEtags: true,
};

export default nextConfig;