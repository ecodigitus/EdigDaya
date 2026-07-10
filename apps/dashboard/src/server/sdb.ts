/**
 * Writable team-table access. Supabase is NO LONGER used — writes now go to the
 * team-prefixed tables (edig_dev_*) in the same Cloud SQL mirror as reads, via
 * `koperasi_app` (which was granted write on the team tables only). This is kept
 * named `sdb` / `supabaseEnabled` to avoid churn in the feature routes, but it
 * is simply the mirror pool. Resolve table names with `team()` from ./tables.
 */
import { db } from "./db";

export const supabaseEnabled = true;
export const sdb = db;
