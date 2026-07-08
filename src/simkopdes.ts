/**
 * Adapter backend pendaftaran anggota (SIMKOPDES).
 *
 * Tujuan akhir: WA jadi "portal" yang mengirim pendaftaran ke database utama
 * pemerintah (SIMKOPDES). Karena endpoint-nya belum tentu tersedia, kode alur
 * aktivasi bergantung pada SATU fungsi `submitActivation()` — bukan pada detail
 * backend. Pilihan adapter otomatis:
 *   - `SIMKOPDES_API_URL` KOSONG  -> adapter DUMMY (in-memory, no. anggota palsu)
 *   - `SIMKOPDES_API_URL` DIISI   -> POST ke API SIMKOPDES asli
 * Jadi begitu endpoint diberikan, cukup isi .env — tanpa mengubah alur.
 */
import { config } from './config';
import { logger } from './logger';

const REQUEST_TIMEOUT_MS = 20_000;

export type ActivationPayload = {
  namaLengkap: string;
  nik: string;
  jenisKelamin: string;
  email: string;
  nomorHp: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  desa: string;
  koperasi: string;
  setujuDomisili: boolean;
  setujuPdp: boolean;
  referralCode?: string; // kode pengajak (program Gotong Royong), bila ada
};

export type ActivationResult = { ok: boolean; noAnggota?: string; error?: string };

/** Kirim data aktivasi. Memilih adapter dummy / SIMKOPDES sesuai konfigurasi. */
export async function submitActivation(payload: ActivationPayload): Promise<ActivationResult> {
  return config.simkopdes.apiUrl ? submitToSimkopdes(payload) : submitDummy(payload);
}

/** Adapter DUMMY: tak menyentuh jaringan; buat no. anggota deterministik dari NIK. */
async function submitDummy(payload: ActivationPayload): Promise<ActivationResult> {
  // Tidak me-log data pribadi (NIK/email) — cukup penanda proses (OWASP / UU PDP).
  logger.info({ mode: 'dummy' }, 'Aktivasi anggota diproses (adapter dummy)');
  const noAnggota = `KMP-2026-${payload.nik.slice(-4)}`;
  return { ok: true, noAnggota };
}

/** Adapter SIMKOPDES: POST payload ke API pemerintah (HTTPS), dengan timeout. */
async function submitToSimkopdes(payload: ActivationPayload): Promise<ActivationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(config.simkopdes.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.simkopdes.apiKey ? { Authorization: `Bearer ${config.simkopdes.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'SIMKOPDES menolak aktivasi');
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { noAnggota?: string; no_anggota?: string };
    return { ok: true, noAnggota: data.noAnggota ?? data.no_anggota };
  } catch (err) {
    logger.error({ err }, 'Gagal menghubungi SIMKOPDES');
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
