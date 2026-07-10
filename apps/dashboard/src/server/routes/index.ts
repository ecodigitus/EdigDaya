/**
 * Route registry. Importing this module registers all API routes as a side
 * effect. Import it from `src/index.ts` AFTER `./server/router` so the route
 * table is initialized first.
 */
import "./health";
import "./auth";
import "./pengurus";
import "./anggota";
import "./nasional";
import "./akun";
import "./preorder";
import "./konten";
import "./profilkop";
