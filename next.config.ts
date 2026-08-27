import type { NextConfig } from "next";

/**
 * Static export only (SAD AD-2). Do not add SSR, API routes, route handlers,
 * server actions, middleware, redirects, rewrites or headers — `next build`
 * fails on all of them under `output: "export"`, and Netlify serves `out/`
 * as plain files with no server behind it.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Emit /admin/index.html rather than /admin.html so Netlify resolves
  // deep links without rewrite rules (which static export cannot use).
  trailingSlash: true,
};

export default nextConfig;
