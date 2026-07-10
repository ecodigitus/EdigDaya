/**
 * Tenant scope helpers. The scope comes from the SIGNED session token, never
 * from client query/body values — this is the core defense against a user
 * reaching another koperasi's/anggota's data (OWASP A01). Route guards ensure
 * the session is present with the right role before these run.
 */
import type { Session } from "./auth";

export function koperasiScope(session: Session | null): string {
  const ref = session?.koperasi_ref;
  if (!ref) throw new Error("Missing koperasi scope in session");
  return ref;
}

export function anggotaScope(session: Session | null): { koperasi_ref: string; anggota_ref: string } {
  const koperasi_ref = session?.koperasi_ref;
  const anggota_ref = session?.anggota_ref;
  if (!koperasi_ref || !anggota_ref) throw new Error("Missing anggota scope in session");
  return { koperasi_ref, anggota_ref };
}

/** Scope for WA members: the member's own no_anggota (PK of edig_dev_members). */
export function waScope(session: Session | null): string {
  const no = session?.no_anggota;
  if (!no) throw new Error("Missing anggota_wa scope in session");
  return no;
}
