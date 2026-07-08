# Tech Stack — WhatsApp CS Chatbot

MVP chatbot Customer Service WhatsApp untuk koperasi. Hybrid: **menu rule-based + AI (Claude)**.

---

## Ringkasan

| Kategori | Teknologi |
|---|---|
| Bahasa | TypeScript (ES2022, ESM) |
| Runtime | Bun `>=1.2` (jalanin TypeScript langsung, tanpa build) |
| Runner/Dev | Bun (`bun --watch`) |
| Integrasi WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| AI / LLM | Groq (default, OpenAI-compatible via `fetch`) atau Anthropic Claude — pilih via `AI_PROVIDER` |
| Logging | pino |
| Konfigurasi | dotenv (`.env`) |
| Utilitas | qrcode-terminal (tampil QR login WA di terminal) |

---

## Dependencies

### Runtime (`dependencies`)
- **`@whiskeysockets/baileys`** `^7.0.0-rc13` — koneksi WhatsApp Web (tanpa API resmi), kirim/terima pesan, auth via QR.
- **`@anthropic-ai/sdk`** `^0.110.0` — memanggil Claude (dipakai bila `AI_PROVIDER=anthropic`).
- **Groq** — dipanggil via `fetch` bawaan (endpoint OpenAI-compatible), **tanpa dependency tambahan**.
- **`pino`** `^10.3.1` — structured logging.
- **`dotenv`** `^17.4.2` — load environment variable dari `.env`.
- **`qrcode-terminal`** `^0.12.0` — render QR code login WhatsApp di terminal.

### Development (`devDependencies`)
- **`typescript`** `^6.0.3` — compiler / type checking (`tsc --noEmit`).
- **`@types/bun`**, **`@types/node`**, **`@types/qrcode-terminal`** — type definitions.

---

## Scripts

```bash
bun install        # pasang dependencies (buat bun.lock)
bun run dev        # bun --watch src/index.ts  (development, auto-reload)
bun start          # bun run src/index.ts      (jalan sekali)
bun run typecheck  # tsc --noEmit              (cek tipe)
```

---

## Konfigurasi TypeScript
- `target`: ES2022, `module`: ESNext, `moduleResolution`: bundler
- `strict`: true, `noEmit`: true (dijalankan lewat Bun, bukan di-compile)

---

## Struktur Source (`src/`)

| File | Fungsi |
|---|---|
| `index.ts` | Entry point — start bot, cleanup sesi berkala, handle sinyal proses |
| `config.ts` | Konfigurasi terpusat dari `.env` (tak ada secret hardcoded) |
| `whatsapp.ts` | Koneksi & event Baileys |
| `router.ts` | Routing pesan masuk: aktivasi → ngobrol AI → menu / AI |
| `welcome.ts` | Welcome card (perintah *mulai*): logo + caption + pilihan bernomor |
| `activation.ts` | Aktivasi akun: opsi *4* = kilat (data contoh), *aktivasi manual* = form 12 langkah |
| `simkopdes.ts` | Adapter backend pendaftaran: dummy (default) / API SIMKOPDES |
| `wilayah.ts` | Data wilayah dummy (cascade Provinsi→Kab→Kec→Desa→Koperasi) |
| `referral.ts` | Program referral "Gotong Royong": kode ajakan + poin bonus SHU |
| `preorder.ts` | Sistem Pre-Order: form user, DB harga/produsen, command admin, notifikasi |
| `menu.ts` | Menu rule-based |
| `ai.ts` | Integrasi Claude (system prompt, generate balasan) |
| `session.ts` | State percakapan per user + TTL |
| `members.ts` | Data anggota koperasi |
| `business.ts` | Konteks bisnis / profil koperasi |
| `campaigns.ts` | Broadcast / campaign proaktif |
| `onboarding.ts` | Alur onboarding anggota |
| `format.ts` | Helper format (mis. rupiah) |
| `logger.ts` | Setup pino logger |

---

## Environment Variables (`.env`)

| Variable | Default | Keterangan |
|---|---|---|
| `AI_PROVIDER` | `groq` | Penyedia AI: `groq` atau `anthropic` |
| `GROQ_API_KEY` | *(kosong)* | API key Groq. Kalau kosong (provider groq), fitur AI nonaktif → bot **mode rule-based** saja |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model di Groq |
| `GROQ_MAX_TOKENS` | `1024` | Batas token balasan Groq |
| `ANTHROPIC_API_KEY` | *(kosong)* | API key Claude (dipakai bila `AI_PROVIDER=anthropic`) |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Model Claude |
| `ANTHROPIC_MAX_TOKENS` | `1024` | Batas token balasan Claude |
| `SIMKOPDES_API_URL` | *(kosong)* | Endpoint aktivasi SIMKOPDES. Kosong = adapter **dummy** |
| `SIMKOPDES_API_KEY` | *(kosong)* | Bearer token API SIMKOPDES (bila diperlukan) |
| `WA_AUTH_DIR` | `auth` | Folder penyimpanan kredensial WhatsApp |
| `WA_LOGO_PATH` | `assets/logo-kdmp.jpg` | Logo di welcome card (perintah *mulai*) |
| `WA_HANDLE_GROUPS` | `false` | Tangani pesan grup atau tidak |
| `ADMIN_NUMBERS` | *(kosong)* | Nomor yang boleh trigger broadcast (pisah koma) |
| `BROADCAST_TARGETS` | *(kosong)* | Nomor tujuan broadcast |
| `MAX_INBOUND_CHARS` | `2000` | Batas panjang pesan masuk |
| `RATE_MAX_PER_MIN` | `15` | Rate limit per menit |
| `HISTORY_TURNS` | `6` | Jumlah giliran riwayat yang dikirim ke AI |
| `SESSION_TTL_MINUTES` | `60` | Umur sesi tak aktif |
| `LOG_LEVEL` | `info` | Level log pino |

---

## Catatan Keamanan (OWASP)
- Semua secret via env var, **tidak hardcoded** (OWASP A05: Security Misconfiguration).
- Input user diperlakukan sebagai **tak terpercaya**; aturan bot hanya di system prompt (mitigasi prompt injection).
- Rate limiting (`RATE_MAX_PER_MIN`) & batas panjang input (`MAX_INBOUND_CHARS`).
- Cleanup sesi berkala untuk mencegah memory leak.
- Panggilan AI (Groq) ke endpoint **tetap/hardcoded** (bukan dari input user) + **timeout 20 dtk** — hindari SSRF & resource exhaustion. Detail error API tak dibocorkan ke user.
- **Aktivasi akun (UU PDP No.27/2022):** password **tidak** diminta lewat chat (WA menyimpan riwayat); data form **tidak di-log** (tak masuk history AI maupun logger, NIK di-mask di ringkasan); validasi ketat (NIK 16 digit, email, HP); persetujuan Domisili + PDP **wajib** sebelum submit. Pengiriman ke SIMKOPDES via HTTPS + timeout.
- **Pre-Order:** command admin (`po quote/final/...`) dibatasi ke `ADMIN_NUMBERS` (OWASP A01); user hanya bisa konfirmasi/batal PO miliknya sendiri; harga/durasi divalidasi (durasi wajib); DP & pembayaran bersifat **dummy** (tanpa transaksi nyata).

## Command Admin (dari nomor `ADMIN_NUMBERS`)
```
po list                                   # daftar semua PO
po lihat <id>                             # detail PO
po quote <id> <harga|auto> <durasi> [produsen]   # kirim penawaran (durasi hari, WAJIB)
po alih <id> [produsen]                   # alihkan ke produsen cadangan (Poin 2)
po final <id>                             # finalisasi (setelah DP dibayar)
po batal <id>                             # batalkan PO
push voting | push nudge                  # broadcast campaign proaktif
```
