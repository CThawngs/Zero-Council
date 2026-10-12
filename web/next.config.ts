import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dev-only. Next.js refuses cross-origin requests for dev resources
   * (`/_next/hmr`, the client chunks) by default, and treats `127.0.0.1` as a
   * different origin from `localhost`.
   *
   * That refusal has a brutal failure mode: the browser receives the full
   * server-rendered HTML, so the page LOOKS perfect, but the client runtime
   * never hydrates. Every button, link and form keeps its markup and silently
   * loses its handler, and the only console entry is the HMR WebSocket
   * failing. Nothing is clickable and nothing reports a React error.
   *
   * This affects local verification only — it has no production behaviour.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
