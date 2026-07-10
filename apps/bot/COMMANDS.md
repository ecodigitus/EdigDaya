# 📖 Daftar Command — WhatsApp Chatbot Koperasi (EdigKop)

Semua interaksi lewat **chat WhatsApp** (balas *angka* atau *kata kunci* — tidak case-sensitive).
Bot bersifat *hybrid*: rule-based (menu/kata kunci) → intent AI (kalimat bebas) → ngobrol AI.

> Legenda: 🌱 calon anggota · 👤 anggota aktif · 🛠️ admin/pengurus · 🎬 demo

---

## 1. Umum / Navigasi (semua user)

| Command | Fungsi |
|---|---|
| `mulai` · `start` · `/mulai` · `/start` | Tampilkan **welcome card** (menu pembuka) |
| `menu` | Buka menu utama (anggota) / info (calon anggota) |
| `batal` · `keluar` · `stop` · `cancel` | Keluar dari alur yang sedang berjalan (form/AI/setor) |
| `reset` · `reset demo` 🎬 | Kembalikan nomor jadi *calon anggota* (buat ulang demo; non-destruktif) |

---

## 2. Calon Anggota (🌱 belum aktivasi)

**Welcome card** (setelah ketik `mulai`) — balas angka:

| Opsi | Fungsi |
|---|---|
| `1` · `periksa aktivasi` · `cek aktivasi` · `sudah terdaftar` | **Periksa Aktivasi** — buat yang sudah terdaftar (masukkan No. Anggota) |
| `2` · `apa itu koperasi` · `belum ngerti` · `manfaat` · `info` | Penjelasan koperasi |
| `3` · `menu` | Menu (terkunci sampai aktivasi) |
| `4` · `ngobrol` · `tanya` · `ai` · `chat` · `asisten` | Ngobrol dengan asisten AI |
| `5` · `aktivasi` · `daftar` · `gabung` · `registrasi` | **Aktivasi akun baru** (sub-menu: kilat / form) |

**Lainnya:**

| Command | Fungsi |
|---|---|
| `aktivasi manual` · `daftar manual` · `form manual` | Langsung ke **form 12 langkah** |
| `untung` · `simulasi` · `hitung untungku` · `cuan` | Simulasi keuntungan jadi anggota |
| `video` · `nonton` | Video perkenalan (bila tersedia) |
| 📷 **kirim foto KTP** | OCR otomatis → isi data pendaftaran (nama, NIK, dll) |

**Aktivasi kilat/form** → di sub-menu balas `1` (kilat/demo) atau `2` (form lengkap).

---

## 3. Menu Utama Anggota (👤)

Ketik **angka** atau **kata kunci**:

| # | Menu | Kata kunci |
|---|------|-----------|
| `1` | 👤 Informasi Saya | `informasi saya` · `profil` · `data saya` |
| `2` | 💰 Simpanan Saya | `simpanan` · `saldo` · `tabungan` |
| `3` | 📈 Estimasi SHU | `shu` · `sisa hasil usaha` · `bagi hasil` |
| `4` | 🏦 Pinjaman | `pinjaman` · `kredit` · `pinjam` · `utang` |
| `5` | 🗳️ e-RAT & Voting | `rat` · `e-rat` · `rapat` |
| `6` | 🎯 Poin & Misi | `poin` · `misi` · `lencana` · `skor` · `reward` |
| `7` | 🙋 Hubungi Pengurus | `pengurus` · `admin` · `cs` · `operator` |
| `8` | 🤝 Ajak Teman (Referral) | `referral` · `kode` · `ajak` · `gotong royong` |
| `9` | 📦 Pre-Order Barang | `pre-order` · `preorder` · `pesan barang` · `buat po` |
| `10` | 🏪 Dashboard Usaha / 📊 Keuangan | `usaha` · `dashboard` · `keuangan` · `modal` · `stok` · `penjualan` |
| `11` | 🤖 Ngobrol dengan AI | `ngobrol` · `tanya` · `ai` · `chat` · `asisten` |
| `12` | 👥 Daftar Pengurus | `daftar pengurus` · `susunan pengurus` |
| `13` | 📢 Pengumuman | `pengumuman` · `kabar koperasi` |
| `14` | 🛡️ Anggota Jaga Anggota | `anggota jaga anggota` · `jaga anggota` · `lapor` |
| `15` | 🌐 Koperasi Global (data nasional) | `koperasi global` · `statistik koperasi` · `data nasional` |

---

## 4. Alur Transaksi & Aksi

### 💳 Setor Simpanan
| Command | Fungsi |
|---|---|
| `setor` · `nabung` · `bayar simpanan` · `setor simpanan` | Mulai setor (pilih: wajib/sukarela/pokok) |
| (di alur) `sudah bayar` · `bayar` · `konfirmasi` · `ya` | Konfirmasi pembayaran (VA demo) |

### 📦 Pre-Order
| Command | Fungsi |
|---|---|
| `9` · `buat po` · `pesan barang` | Buat pre-order baru |
| `po` · `pesanan saya` · `pesananku` | Lihat daftar PO |
| (balas penawaran) `setuju` · `ya` · `lanjut` / `batal` · `tolak` | Terima / tolak penawaran admin |

### 🗳️ Voting e-RAT
| Command | Fungsi |
|---|---|
| `voting` · `vote` · `beri suara` · `pilih` | Buka surat suara digital |
| (di alur) `1` / `2` / `3` | Pilih opsi suara → +30 poin |

### 🔔 Nudge (re-aktivasi)
| Command | Fungsi |
|---|---|
| `nudge` · `ingatkan` · `reminder` | Picu ajakan bayar simpanan wajib |
| (balas) `YA` / `NANTI` | Bayar sekarang (+50 poin) / nanti |

### 🛡️ Anggota Jaga Anggota (menu 14)
| Command | Fungsi |
|---|---|
| `lapor` · `buat laporan` | Buat laporan kejanggalan (append-only, disiar ke anggota) |
| `daftar laporan` · `lihat laporan` | Lihat semua laporan |

---

## 5. Input Non-Teks

| Aksi | Fungsi |
|---|---|
| 🎤 **Voice note** | Ditranskrip (Bahasa Indonesia) → diproses seperti teks (mis. ngomong "setor sukarela 500 ribu") |
| 📷 **Foto KTP** (calon anggota) | OCR → isi data pendaftaran otomatis → review & koreksi → lanjut |

---

## 6. Kalimat Bebas (Intent AI) 👤

Nggak harus hafal command — **ngomong/ketik bebas**, bot paham maksudnya:

| Contoh | Aksi |
|---|---|
| "tolong aku mau setor simpanan sukarela 500rb" | → langsung ke konfirmasi setor sukarela Rp500.000 |
| "bayar simpanan wajib dong" | → setor wajib |
| "saldoku berapa ya" | → buka Simpanan |
| "estimasi bagi hasilku" | → buka SHU |
| "info pinjaman" · "poin aku" · "data diriku" | → menu terkait |
| pertanyaan umum ("apa itu SHU?") | → dijawab asisten AI |

---

## 7. Command Demo / Utilitas 🎬

| Command | Fungsi |
|---|---|
| `ganti model groq` · `pakai groq` | Ganti provider AI → **Groq** (gratis, cepat) |
| `ganti model vertex` · `ganti model gemini` | Ganti AI → **Gemini 2.5-flash (Vertex, credit GCP)** |
| `ganti model claude` | Ganti AI → Claude *(butuh API key)* |
| `model apa` · `model sekarang` | Lihat provider AI yang aktif |
| `mode produsen` · `lihat sebagai produsen` | Toggle POV **produsen** (demo 1 HP) |
| `mode anggota` · `lihat sebagai anggota` | Toggle POV **anggota/konsumen** |
| `notif` · `notifikasi` · `pengingat` | Menu demo push notification |
| `notif wajib` / `notif shu` / `notif erat` / `notif pinjaman` | Kirim push notif tertentu (~5 detik, datang sendiri) |

---

## 8. Command Admin/Pengurus 🛠️

> Hanya untuk **nomor terdaftar** di `ADMIN_NUMBERS` (.env).

| Command | Fungsi |
|---|---|
| `push voting` · `broadcast voting` | Kirim surat suara e-RAT proaktif ke `BROADCAST_TARGETS` |
| `push nudge` · `broadcast nudge` | Kirim nudge re-aktivasi proaktif |
| `po` · `po lihat` | Lihat semua PO masuk |
| `po quote <id> ...` · `po final <id>` · `po batal <id>` | Kelola PO (penawaran/finalisasi/batal) |

---

## Catatan
- **Reset demo**: ketik `reset` → nomor balik jadi calon anggota (buat ulang alur ke juri).
- **Keluar** dari alur mana pun: `batal` / `menu` / `mulai`.
- Data & pembayaran = **dummy/simulasi** (MVP Hackathon). Tidak ada transaksi nyata.
