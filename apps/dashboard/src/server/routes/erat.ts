/**
 * e-RAT voting (surat suara digital) untuk anggota WA — sumber: store in-memory
 * (erat.ts). Scope no_anggota dari SESSION bertanda-tangan → satu suara/anggota.
 */
import { route } from "../router";
import { json, err, readJson } from "../http";
import { waScope } from "../scope";
import { eratState, castVote } from "../erat";

const ANGGOTA_WA = ["anggota_wa"] as const;

// GET /api/anggota-wa/erat — agenda + surat suara + hasil sementara + status suaraku.
route(
  "GET",
  "/api/anggota-wa/erat",
  async ({ session }) => {
    const no = waScope(session);
    return json(eratState(no));
  },
  ANGGOTA_WA,
);

// POST /api/anggota-wa/erat/vote { pilihan } — beri suara sekali.
route(
  "POST",
  "/api/anggota-wa/erat/vote",
  async ({ session, req }) => {
    const no = waScope(session);
    const body = await readJson<{ pilihan?: string }>(req);
    const key = String(body?.pilihan ?? "").trim();
    const e = castVote(no, key);
    if (e === "sudah") return err(409, "Kamu sudah memberikan suara di e-RAT ini.");
    if (e === "invalid") return err(400, "Pilihan tidak valid.");
    return json({ ok: true, ...eratState(no) });
  },
  ANGGOTA_WA,
);
