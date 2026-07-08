# 🌾 Asisten Anggota Koperasi — WhatsApp Bot (MVP)

Chatbot WhatsApp **hybrid** (menu cepat + AI Claude) sebagai **Asisten Anggota Koperasi**.
Dibuat untuk **Hackathon Digital Cooperatives Expo 2026 (Kemenkop RI) — Tema 3:
Keterlibatan Masyarakat dalam Berkoperasi**.

> Ini **MVP dengan data dummy** — gambaran konkret dari fitur *"AI Member Assistant"*.
> Ide inti, konsep, dan keputusan desain tetap harus dirumuskan & dikembangkan tim (aturan orisinalitas TOR).

- **WhatsApp:** [Baileys](https://github.com/WhiskeySockets/Baileys) — konek via scan QR, tanpa browser.
- **AI:** [Claude](https://www.anthropic.com/) via `@anthropic-ai/sdk`.
- **Bahasa:** TypeScript (`tsx`, tanpa build step).

---

## 🎯 Kenapa WhatsApp? (kaitan ke Tema 3)

Analisis funnel keterlibatan menunjukkan bocor terbesar ada di **"Kenal → Gabung"** —
citra kuno, harus datang ke kantor, aplikasi terasa asing. **WhatsApp adalah channel
yang anggota (terutama di desa) sudah pakai tiap hari, tanpa install apa pun.**
Jadi bot ini menurunkan barrier keterlibatan, dan menyentuh **seluruh funnel**:

| Menu bot | Tahap funnel | Challenge Question |
| --- | --- | --- |
| 1 · Info & cara jadi anggota | Kenal → Gabung | CQ-1, CQ-4 (kemudahan) |
| 2 · Simpanan saya | Transaksi | CQ-4 (transparansi) |
| 3 · Estimasi SHU saya | Transaksi | CQ-4 (transparansi) |
| 4 · Pinjaman | Transaksi | CQ-4 |
| 5 · e-RAT & voting | Bersuara | CQ-2 (partisipasi muda) |
| 6 · Poin & misi (skor keterlibatan) | Aktif | CQ-3 (engagement) |
| 7 · Hubungi pengurus | (handoff) | — |

Posisi di solusi besar: bot ini = **fitur pendukung / diferensiasi "AI Member Assistant"**,
bukan produk inti. Produk inti tetap web/PWA-nya (sesuai rekomendasi analisis).

---

## ⭐ Fitur Andalan: Mesin Engagement (Proaktif)

Pembeda utama vs tim lain yang juga pakai WA: bot ini **tidak cuma ditunggu, tapi
MENGHAMPIRI**. Satu engine ([src/campaigns.ts](src/campaigns.ts)), dua tipe campaign:

**1. Nudge — re-aktivasi anggota pasif.** Skor keterlibatan turun / simpanan telat →
bot kirim ajakan **1-aksi** → anggota tinggal balas `YA` → aksi tercatat, **poin & skor
naik**. *Analitik yang jadi AKSI* (loop yang jarang ada di aplikasi koperasi).

**2. e-RAT Voting via WhatsApp.** Anggota (termasuk yang tak pernah hadir RAT) memberi
suara **langsung dari chat** → **tally real-time + hitung kuorum + keputusan sementara**.
Menutup leak funnel paling dalam (Bersuara / partisipasi anak muda · CQ-2).

> **Kenapa game-changing:** WhatsApp punya open-rate ~90%+. Fitur *outbound* seperti ini
> mustahil di web/PWA murni (harus dibuka user). Inilah superpower yang jarang dipakai tim lain.
> Untuk demo, pemicu dibuat **manual** (demo stability > segalanya); di produksi = scheduler
> (cron) otomatis berbasis skor keterlibatan.

---

## 🪝 Menambal Tahap "Kenal": Onboarding + Simulasi Untung

Bocor terbesar funnel ada di **Tahap 1 (Kenal)** — koperasi terasa kuno & kurang relevan.
Solusi kami: nomor baru disambut sebagai **calon anggota** dengan **hook interaktif**, bukan brosur.

- **Simulasi Untung** (`untung`): prospek ketik nominal nabung → bot balas *angka personal* —
  simpanan setahun, estimasi SHU, dan **hemat vs pinjol**. Angka tentang DIRI mereka jauh lebih
  nge-hook daripada video/teks umum, sekaligus bikin koperasi terasa modern & interaktif.
- **Jujur, bukan over-promise**: semua angka diberi label "estimasi" + asumsi pinjol eksplisit
  (menghindari kesan skema investasi — penting buat juri & kepatuhan).
- **`gabung`** → prospek jadi anggota → funnel nyambung mulus ke fitur anggota.

> Kenapa bukan video sebagai hook utama? Boros kuota (anggota desa) & watch-rate rendah.
> Slot link video tetap ada (opsional) via `koperasi.introVideoUrl`.

---

## 🚀 Cara Menjalankan

```bash
npm install          # 1. install (sekali saja)
# 2. (opsional) isi ANTHROPIC_API_KEY di .env untuk aktifkan AI
npm start            # 3. jalankan, lalu scan QR di terminal
```
Scan QR di HP: **WhatsApp → Perangkat Tertaut → Tautkan perangkat**.
Setelah `✅ Terhubung`, kirim pesan ke nomor itu **dari HP lain**.

> Sudah pernah jalan tapi tema masih lama? **Restart** bot (`Ctrl+C` lalu `npm start`)
> untuk memuat kode baru — **tidak perlu scan QR ulang** (sesi tersimpan di `auth/`).

---

## 🧪 Cara Demo (buat juri)

Kirim dari HP mana pun. **Nomor baru dianggap CALON ANGGOTA (prospek)** — jadi kamu bisa
demokan funnel UTUH: Kenal → Gabung → fitur anggota.

**① Tahap Kenal (kamu sebagai prospek):**

| Ketik | Hasil |
| --- | --- |
| `halo` | 👋 Sapaan hook: benefit + social proof (247 anggota, total SHU dibagi) |
| `untung` | 💡 Simulasi untung → ketik nominal (mis. `100rb`) → **angka personal + hemat vs pinjol** |
| `apa itu koperasi` | Penjelasan singkat & renyah |
| `gabung` | 🎉 Jadi anggota (demo) → menu anggota langsung muncul |

**② Setelah `gabung` (jadi anggota, profil demo "Andi Wijaya"):**

| Ketik | Hasil |
| --- | --- |
| `menu` | Menu utama 7 pilihan |
| `2` atau `simpanan` | Rincian simpanan + total (data dummy) |
| `3` atau `shu` | Estimasi SHU berjalan |
| `6` atau `poin` | Poin, lencana, **skor keterlibatan**, misi mingguan |
| `SHU saya berapa?` (tanya bebas) | **Jawaban AI** pakai data anggota 🧠 |
| `cara nabung tiap bulan berapa?` | **Jawaban AI** pakai konteks koperasi |
| `voting` | 🗳️ **Surat suara e-RAT** → balas `1`/`2`/`3` → **tally real-time + kuorum** |
| `nudge` | 🔔 **Nudge re-aktivasi** → balas `YA` → **poin & skor naik live** |

**Demo "push" proaktif (butuh HP ke-2):** isi `ADMIN_NUMBERS` + `BROADCAST_TARGETS` di `.env`,
lalu dari nomor admin ketik `push voting` / `push nudge` → HP tujuan dapat pesan **tanpa
diminta** — bukti bot menghampiri anggota. 🚀

Mau demo personalisasi per orang? Tambahkan nomor + data di [src/members.ts](src/members.ts)
(sudah ada contoh "Bu Sri Rahayu" = teladan, "Pak Budi" = pasif untuk skenario re-aktivasi).

---

## 🎨 Kustomisasi

| Mau ubah… | Edit file |
| --- | --- |
| Profil koperasi, jam, simpanan, e-RAT, FAQ | [src/business.ts](src/business.ts) |
| Data anggota dummy | [src/members.ts](src/members.ts) |
| Menu / kata kunci | [src/menu.ts](src/menu.ts) |
| Kepribadian & aturan AI | [src/ai.ts](src/ai.ts) |
| Batas rate limit, panjang pesan | `.env` |

---

## 🧠 Model Claude

Ganti `ANTHROPIC_MODEL` di `.env`:

| Model | Kecepatan | Biaya (per 1 juta token) | Cocok untuk |
| --- | --- | --- | --- |
| `claude-haiku-4-5` | ⚡ tercepat | ~$1 / $5 | **Asisten anggota volume tinggi** (rekomendasi) |
| `claude-sonnet-4-6` | sedang | ~$3 / $15 | Seimbang |
| `claude-opus-4-8` | paling pintar | ~$5 / $25 | Pertanyaan kompleks |

---

## 🔒 Keamanan (OWASP — sesuai bagian F analisis)

- ✅ Secret hanya di `.env` (A05); `.env` & folder `auth/` masuk `.gitignore`. Commit hanya `.env.example`.
- ✅ `auth/` = kredensial sesi WhatsApp (setara token login) — **jangan pernah di-commit / dibagikan**.
- ✅ Validasi input (pesan kosong/terlalu panjang ditolak) + rate limiting per user (A03, anti-abuse).
- ✅ Nomor HP disamarkan di log (A09 / lindungi PII — UU PDP).
- ✅ Instruksi bot terkunci di system prompt (mitigasi prompt injection); AI cakupannya dibatasi + ada fallback ke pengurus.
- ✅ Data anggota = **dummy** (tidak ada data pribadi asli di repo demo).

---

## 🤖 Disclosure Penggunaan AI (wajib per aturan TOR)

Contoh kalimat untuk README/deck final — **sesuaikan dengan fakta tim kalian**:

> *"Tim menggunakan AI generatif (Claude) sebagai alat bantu untuk penulisan & debugging
> kode serta riset pendukung. Fitur Asisten Anggota berbasis Claude API sebagai komponen
> produk, dengan cakupan dibatasi pada layanan koperasi. Seluruh gagasan inti, analisis
> masalah, dan keputusan desain dirumuskan oleh anggota tim."*

---

## 📁 Struktur

```
src/
├── index.ts       # Entry point: start bot + cleanup sesi
├── config.ts      # Baca & validasi .env
├── logger.ts      # Logging (pino) + penyamaran nomor
├── business.ts    # << Profil KOPERASI & FAQ (dummy)
├── members.ts     # << Data ANGGOTA dummy (simpanan, SHU, poin, pinjaman)
├── format.ts      # Helper format Rupiah
├── menu.ts        # Router rule-based (menu fitur koperasi)
├── ai.ts          # Asisten Anggota berbasis Claude (paham data anggota)
├── onboarding.ts  # << Hook prospek: welcome + simulasi untung + gabung (Tahap "Kenal")
├── campaigns.ts   # << Mesin Engagement: nudge + e-RAT voting (FITUR ANDALAN)
├── session.ts     # Riwayat chat per-user + rate limit (in-memory)
├── router.ts      # Otak hybrid: prospek → campaign → menu → AI
└── whatsapp.ts    # Koneksi Baileys, QR, handler pesan + broadcast admin
```

---

## ⚠️ Catatan Produksi

- **Sesi & data anggota masih in-memory/dummy** → sambungkan ke database anggota nyata (mis. SIMKOPDES).
- Baileys tidak resmi (berisiko banned) → untuk skala besar, migrasi ke **WhatsApp Cloud API resmi**.
- Verifikasi identitas anggota sebelum menampilkan data finansial (jangan andalkan nomor saja).
