/** GET /api/health — verifies the DB connection and reports identity. */
import { route } from "../router";
import { json, serverError } from "../http";
import { healthcheck } from "../db";
import { config } from "../config";

route("GET", "/api/health", async () => {
  try {
    const db = await healthcheck();
    return json({
      ok: true,
      db,
      team: config.teamName || null,
      tablePrefix: config.tablePrefix || null,
    });
  } catch (e) {
    return serverError("health", e);
  }
});
