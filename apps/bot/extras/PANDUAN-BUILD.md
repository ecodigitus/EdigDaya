# 🛠️ Panduan Build dari Nol — WA CS Chatbot Koperasi

Panduan ini membangun project **bertahap (milestone)**. Tiap milestone bisa
**dijalankan & dites** sebelum lanjut — jadi kamu paham tiap potongan, bukan
sekadar copy-paste. Urutan file mengikuti **ketergantungan** (yang paling dasar
dulu), supaya tiap file yang kamu tulis, semua yang di-`import`-nya sudah ada.

> Target: kamu bisa menulis ulang & **menjelaskan** tiap file ke juri.
> AI cukup untuk *debugging* (sesuai aturan) — logika & urutan ada di kepalamu.

---

## 🧩 Peta ketergantungan (kenapa urutannya begini)

```
config ─┐
logger ─┼─► (dasar, tak bergantung file lain)
format ─┘
        │
referral ─► members ─► business ──► ai
                    │           └──► simpanan ─► campaigns ─► notifications
                    ├──► usaha
                    ├──► menu
                    ├──► activation ─► (simkopdes, wilayah)
                    └──► onboarding ─► welcome
                                     │
                       semua di atas ─► router ─► whatsapp ─► index
```

Aturan mainnya: **file yang di-`import` harus dibuat lebih dulu.** `router.ts`
paling akhir (dia "otak" yang manggil semua), lalu `whatsapp.ts` (jembatan ke
WhatsApp), lalu `index.ts` (titik start).

---

## Milestone 0 — Setup environment & project

### 0.1 Install Bun (Windows, PowerShell)
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```
Tutup lalu buka lagi terminal, cek:
```powershell
bun --version   # harus keluar angka, mis. 1.2.x
```

### 0.2 Bikin folder + git
```powershell
mkdir hackaton-ui
cd hackaton-ui
git init
```

### 0.3 Inisialisasi Bun + dependencies
```powershell
bun init -y
```
Install library yang dipakai:
```powershell
# runtime
bun add @whiskeysockets/baileys @anthropic-ai/sdk dotenv pino qrcode-terminal
# dev (types + typescript)
bun add -d @types/bun @types/node @types/qrcode-terminal typescript
```
Kegunaan tiap library:
| Library | Untuk apa |
|---|---|
| `@whiskeysockets/baileys` | Koneksi WhatsApp Web (kirim/terima pesan, QR) |
| `@anthropic-ai/sdk` | Panggil AI (Claude / kompatibel Groq via baseURL) |
| `dotenv` | Baca konfigurasi rahasia dari `.env` |
| `pino` | Logging terstruktur (JSON) |
| `qrcode-terminal` | Tampilkan QR pairing di terminal |

### 0.4 `package.json` — tambahkan scripts
```json
{
  "type": "module",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```
`--watch` = auto-restart tiap file disimpan. `typecheck` = cek error TS tanpa build.

### 0.5 `.gitignore` — JANGAN commit rahasia
```gitignore
node_modules/
.env
.env.*
!.env.example
auth/          # kredensial login WhatsApp — setara token, rahasia!
*.log
logs/
.DS_Store
Thumbs.db
```

### 0.6 `.env.example` (template) lalu copy ke `.env`
```dotenv
# ── AI (opsional; kosong = bot jalan rule-based/menu saja) ──
AI_PROVIDER=groq                 # groq | anthropic
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8

# ── SIMKOPDES (kosong = adapter dummy in-memory) ──
SIMKOPDES_API_URL=
SIMKOPDES_API_KEY=

# ── WhatsApp ──
WA_AUTH_DIR=auth
WA_LOGO_PATH=assets/logo-kdmp.jpg
WA_HANDLE_GROUPS=false

# ── Demo push proaktif (opsional) ──
ADMIN_NUMBERS=                   # 628xxx,628yyy — boleh trigger broadcast
BROADCAST_TARGETS=               # nomor tujuan demo push

# ── Batasan (anti-spam / hemat) ──
MAX_INBOUND_CHARS=2000
RATE_MAX_PER_MIN=15
HISTORY_TURNS=6
SESSION_TTL_MINUTES=60
LOG_LEVEL=info
```
```powershell
Copy-Item .env.example .env
```
Taruh juga logo koperasi di `assets/logo-kdmp.jpg` (bebas gambar apa pun).

✅ **Checkpoint 0:** `bun --version` jalan, folder `src/` ada, `.env` terisi.

---

## Milestone 1 — Bisa konek WhatsApp & balas "menu"

Buat file **berurutan** (semua di folder `src/`):

1. **`config.ts`** — konfigurasi terpusat. Baca semua env (`dotenv/config`),
   ekspor `config`, `aiEnabled`, `activeModel`, `activeKeyEnv`.
   *Tak ada secret di-hardcode (OWASP A05).*
2. **`logger.ts`** — instance `pino` pakai `config.logLevel`. Ekspor `logger`,
   `waLogger` (buat Baileys, dibikin sunyi biar tak berisik), dan `maskJid()`
   (menyensor nomor di log demi privasi/UU PDP).
3. **`format.ts`** — `rupiah(n)` → `"Rp1.500.000"` (pakai `Intl.NumberFormat`).
4. **`business.ts`** — profil `koperasi` (nama, simpanan, pinjaman, FAQ) +
   `mainMenu(m?)`. Untuk sekarang cukup versi menu sederhana dulu.
5. **`whatsapp.ts`** — inti Baileys: `startBot()` → `useMultiFileAuthState`,
   tampilkan QR, dengar `messages.upsert`, ekstrak teks, balas. Awalnya cukup:
   kalau teks = "mulai/menu" → kirim `mainMenu()`.
6. **`index.ts`** — titik start: log versi, panggil `startBot()`, pasang handler
   `SIGINT`/`unhandledRejection`.

✅ **Checkpoint 1:**
```powershell
bun run dev
```
Scan QR (WhatsApp HP → *Perangkat Tertaut*). Kirim `mulai` dari **HP lain** →
harus dapat menu. **Ini fondasi — pastikan jalan dulu sebelum lanjut.**

> 💡 Baileys nyimpen sesi di folder `auth/`. Kalau mau pairing ulang dari nol,
> hapus folder `auth/` (INI SATU-SATUNYA yang boleh dihapus; jangan yang lain).

---

## Milestone 2 — Anggota & menu rule-based

7. **`referral.ts`** — program "Gotong Royong": `makeCode`, `registerCode`,
   `isValidCode`, `creditReferral`, `stats`. In-memory (`Map`).
8. **`members.ts`** — tipe `Member` + data dummy per-nomor (`byPhone`),
   profil `demoMember`, `getMember`/`isMember`/`activateMember`,
   `newMemberProfile`, `totalSimpanan`.
9. **`session.ts`** — sesi per-user: `history` (konteks AI), rate limit
   (`allowed`), `aiMode`, `record`, `cleanup`.
10. **`menu.ts`** — `matchMenu(raw, m)`: cocokkan pesan ke menu 1–8 (simpanan,
    SHU, pinjaman, e-RAT, poin, pengurus, referral), balasan dipersonalisasi.
11. **`router.ts`** (versi awal) — kenali anggota via `getMember`, teruskan ke
    `matchMenu`; kalau tak cocok, balas arahan menu. Update `whatsapp.ts` untuk
    memanggil `route(jid, text)`.

✅ **Checkpoint 2:** kirim `1`..`8` → balasan personal (nama, saldo, dll).

---

## Milestone 3 — Fallback AI (opsional tapi keren)

12. **`ai.ts`** — `generateReply(history, text, member)`. Bangun *system prompt*
    dari `koperasiContext` (business.ts) + data anggota. Pakai SDK Anthropic;
    untuk Groq set `baseURL` ke endpoint Groq (kompatibel OpenAI/Anthropic).
    *Semua input user dianggap tak-terpercaya; AI dilarang mengarang angka.*
    Lalu di `router.ts`: tambah mode "ngobrol" & fallback ke AI kalau menu miss.

✅ **Checkpoint 3:** isi `GROQ_API_KEY` di `.env`, ketik `ngobrol` → tanya bebas.
Tanpa key → bot tetap jalan (rule-based), ini sengaja (graceful degradation).

---

## Milestone 4 — Prospek (calon anggota) & aktivasi

13. **`welcome.ts`** — `prospectWelcome()` (kartu buat non-anggota) &
    `welcomeCaption(jid)` (anggota→menu, prospek→sambutan).
14. **`onboarding.ts`** — `handleProspect(jid, text)`: penjelasan koperasi,
    simulator "hitung untung", menu terkunci sampai aktivasi.
15. **`simkopdes.ts`** — adapter backend: `submitActivation(payload)`. URL kosong
    → dummy in-memory; URL terisi → POST ke API asli. *Ganti backend tanpa ubah
    alur.* Tidak nge-log data pribadi (NIK/email) → UU PDP.
16. **`wilayah.ts`** — data dropdown provinsi→kabupaten→kecamatan→desa→koperasi.
17. **`activation.ts`** — form 12 langkah (`startActivation`, `handleActivation`)
    + `instantActivation` (aktivasi kilat demo). Validasi NIK/email/HP,
    persetujuan Domisili + UU PDP. *Tak minta password di chat.*
18. Di **`router.ts`**: tambah cabang form aktivasi, prospek, & aktivasi kilat
    (opsi `4`). Di **`whatsapp.ts`**: `WELCOME_TRIGGERS` ("mulai") kirim kartu +
    logo; reset form saat "mulai".

✅ **Checkpoint 4:** dari nomor baru → kartu prospek → ketik `4` → jadi anggota
→ menu kebuka.

---

## Milestone 5 — Campaign proaktif (voting & nudge)

19. **`campaigns.ts`** — dua tipe dalam satu engine:
    - **vote**: surat suara e-RAT, tally real-time + kuorum.
    - **nudge**: re-aktivasi (bayar simpanan wajib) 1-aksi.
    Ekspor `startVoteFor`, `startNudgeFor`, `handleCampaignReply`, `matchTrigger`.
20. Di **`router.ts`**: panggil `handleCampaignReply` & `matchTrigger`.
    Di **`whatsapp.ts`**: perintah admin `push voting`/`push nudge` (khusus
    `ADMIN_NUMBERS` — akses terbatas / OWASP A01).

✅ **Checkpoint 5:** ketik `voting` → surat suara; `nudge` → reminder 1-aksi.

---

## Milestone 6 — Pre-Order (PO) multi-aktor

21. **`preorder.ts`** — alur User↔Admin↔Produsen: buat PO, admin quote harga +
    durasi, user bayar DP 50%, finalisasi. Pakai **outbox** (`drainOutbox`) untuk
    notifikasi proaktif. Command admin dibatasi (OWASP A01).
22. Di **`router.ts`**: entry PO (`9`) + balasan penawaran + daftar PO.
    Di **`whatsapp.ts`**: `flushOutbox(sock)` sesudah tiap pesan/command admin.

✅ **Checkpoint 6:** `pre-order` → isi form; sebagai admin `po quote ...`.

---

## Milestone 7 — Dashboard Usaha (papan tulis poin 2 & 3) ⭐

23. Di **`members.ts`**: tambah field `role` ('produsen'|'anggota'), `keuangan`
    (modal & pengeluaran), `usaha` (produk/stok/terjual/kerugian). Tandai peran
    **per-nomor**.
24. **`usaha.ts`** — `dashboard(jid, m)`: produsen → penjualan/stok/untung-rugi/
    modal; anggota → ringkasan keuangan. Plus toggle demo `setViewRole` (biar 1
    HP bisa peragakan 2 POV). Keuntungan dihitung dari data mentah (transparan).
25. Di **`business.ts`**: `mainMenu(m)` jadi role-aware (item 9 menyesuaikan).
    Di **`router.ts`**: entry `dashboard`/`9` + `mode produsen`/`mode anggota`.

✅ **Checkpoint 7:** ketik `9` atau `dashboard`; coba `mode anggota` lalu `mode produsen`.

---

## Milestone 8 — Setor Simpanan (deposit engine bersama)

26. **`simpanan.ts`** — SATU engine dipakai 3 pintu: `pokokLunas`,
    `creditSimpanan` (ledger murni), `startSetor`/`handleSetor` (pilih jenis →
    Virtual Account dummy → konfirmasi). Nominal server-side; konfirmasi idempoten;
    tak minta PIN/OTP di chat (OWASP).
27. Sambungkan:
    - **`router.ts`**: cabang form setor (A3) + trigger `setor` (G2).
    - **`menu.ts`**: menu 1 (Simpanan) tampilkan status pokok + CTA `setor`.
    - **`activation.ts`**: sesudah daftar, tawarkan bayar pokok (boleh nanti).
    - **`campaigns.ts`**: nudge "YA" → `creditSimpanan(m,'wajib',..)` (beneran
      nambah saldo, bukan cuma poin).

✅ **Checkpoint 8:** `setor` → pilih jenis → `sudah bayar` → saldo (menu `1`) naik.

---

## Milestone 9 — Push Notification (self-push berjadwal)

28. **`notifications.ts`** — engine outbox + `scheduleNotif`. `handleNotifDemo`
    (perintah `demo notif`, `notif wajib/shu/erat/pinjaman`). Sebagian nyambung
    ke flow lama (nudge/voting) biar loop lengkap.
29. Di **`whatsapp.ts`**: "pump" (`setInterval`) yang tiap 3 detik menguras
    `drainNotifs()` dan mengirim via socket aktif → pesan bisa datang **sendiri**.
    Di **`router.ts`**: trigger `handleNotifDemo` (G3).

✅ **Checkpoint 9:** ketik `demo notif` → `notif wajib` → tunggu ~5 detik →
push masuk sendiri → balas `YA` → saldo naik.

---

## 🎤 Urutan demo yang enak buat juri

1. `mulai` → kartu welcome (prospek) → `4` aktivasi kilat → jadi anggota.
2. `menu` → tunjukkan menu 1–9.
3. `1` simpanan → `setor` → `sudah bayar` (transaksi tercatat).
4. `9` dashboard usaha → `mode anggota`/`mode produsen` (bedakan POV).
5. `voting` → surat suara real-time.
6. `demo notif` → `notif wajib` → **diam** → push datang sendiri → balas `YA`.
7. (bonus) sebagai admin: `push nudge` → broadcast proaktif.

## 🧠 Cara belajar biar bisa "defend" (bukan hafal)

- **Kuasai `router.ts` dulu.** Dia peta besar: urutan cabang A→J menjelaskan
  SEMUA fitur. Kalau paham router, kamu paham aplikasinya.
- **Pahami 3 pola berulang:** (a) *form state machine* (activation, preorder,
  simpanan pakai `Map` draft + `step`), (b) *outbox* untuk push, (c) *engine
  bersama* (simpanan dipakai 3 tempat = DRY).
- **Latihan tulis ulang 1 file kecil** tanpa lihat (mis. `format.ts`, lalu
  `menu.ts` satu item). Ketik dari paham, bukan hafal.
- **Siapkan jawaban "kenapa":** kenapa in-memory (MVP, cepat; produksi→DB/Redis),
  kenapa adapter SIMKOPDES (ganti backend tanpa ubah alur), OWASP di mana
  (validasi input, akses admin terbatas, no secret hardcode, no PIN di chat).
- **Boleh pakai AI buat debugging** (sesuai aturan): kalau error, kamu yang baca
  pesan errornya & paham fix-nya — itu skill yang justru dinilai.

---
_Semua data & pembayaran di project ini DUMMY (demo). Tak ada transaksi nyata._
