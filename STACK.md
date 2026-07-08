# Tech Stack — WhatsApp CS Chatbot

MVP chatbot Customer Service WhatsApp untuk koperasi. Hybrid: **menu rule-based + AI (Claude)**.

---

## Ringkasan

| Kategori | Teknologi |
|---|---|
| Bahasa | TypeScript (ES2022, ESM) |
| Runtime | Node.js `>=20` |
| Runner/Dev | tsx (`tsx watch`) |
| Integrasi WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| AI / LLM | Anthropic Claude (`@anthropic-ai/sdk`), model default `claude-opus-4-8` |
| Logging | pino |
| Konfigurasi | dotenv (`.env`) |
| Utilitas | qrcode-terminal (tampil QR login WA di terminal) |

---

## Dependencies

### Runtime (`dependencies`)
- **`@whiskeysockets/baileys`** `^7.0.0-rc13` — koneksi WhatsApp Web (tanpa API resmi), kirim/terima pesan, auth via QR.
- **`@anthropic-ai/sdk`** `^0.110.0` — memanggil Claude untuk balasan AI.
- **`pino`** `^10.3.1` — structured logging.
- **`dotenv`** `^17.4.2` — load environment variable dari `.env`.
- **`qrcode-terminal`** `^0.12.0` — render QR code login WhatsApp di terminal.

### Development (`devDependencies`)
- **`typescript`** `^6.0.3` — compiler / type checking (`tsc --noEmit`).
- **`tsx`** `^4.23.0` — jalankan TypeScript langsung tanpa build.
- **`@types/node`**, **`@types/qrcode-terminal`** — type definitions.

---

## Scripts

```bash
npm run dev        # tsx watch src/index.ts  (development, auto-reload)
npm start          # tsx src/index.ts        (jalan sekali)
npm run typecheck  # tsc --noEmit            (cek tipe)
```

---

## Konfigurasi TypeScript
- `target`: ES2022, `module`: ESNext, `moduleResolution`: bundler
- `strict`: true, `noEmit`: true (dijalankan lewat tsx, bukan di-compile)

---

## Struktur Source (`src/`)

| File | Fungsi |
|---|---|
| `index.ts` | Entry point — start bot, cleanup sesi berkala, handle sinyal proses |
| `config.ts` | Konfigurasi terpusat dari `.env` (tak ada secret hardcoded) |
| `whatsapp.ts` | Koneksi & event Baileys |
| `router.ts` | Routing pesan masuk ke menu / AI |
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
| `ANTHROPIC_API_KEY` | *(kosong)* | Kalau kosong, bot jalan **mode rule-based** (menu) saja |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Model Claude |
| `ANTHROPIC_MAX_TOKENS` | `1024` | Batas token balasan |
| `WA_AUTH_DIR` | `auth` | Folder penyimpanan kredensial WhatsApp |
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
