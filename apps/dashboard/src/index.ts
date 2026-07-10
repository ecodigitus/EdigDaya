import { serve } from "bun";
import index from "./index.html";
import { config } from "./server/config";
import { handleApi } from "./server/router";
import "./server/routes"; // registers all API routes (after router is initialized)
import { dbRole } from "./server/db";

const server = serve({
  port: config.port,
  routes: {
    // API — routed through the RBAC-aware handler.
    "/api/*": (req, srv) => handleApi(req, srv),
    // SPA — Bun bundles index.html and its imports; serves for all other paths.
    "/*": index,
  },
  development: config.isProd ? false : { hmr: true, console: true },
});

console.log(`🚀 Server: ${server.url}  (DB: ${dbRole}, env: ${config.nodeEnv})`);
