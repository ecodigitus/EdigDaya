/**
 * Welcome card — respons untuk perintah "mulai"/"start".
 * whatsapp.ts mengirim logo koperasi + caption ini sebagai satu pesan gambar.
 *
 * Pilihan disajikan sebagai menu teks bernomor (bukan tombol WA native, yang
 * tak lagi didukung Baileys untuk akun personal). User cukup balas angka/kata
 * kunci — balasannya di-route seperti biasa (prospek: onboarding, anggota: menu).
 */
import { koperasi, mainMenu } from './business';
import { isMember, getMember } from './members';

/** Sapaan awal untuk CALON anggota (prospek). */
export function prospectWelcome(): string {
  return (
    `Halo! 👋 Selamat datang di layanan WhatsApp\n` +
    `*${koperasi.name}* 🇮🇩🏠\n\n` +
    `Aku asisten digitalmu — siap bantu kenalan sama koperasi & jawab pertanyaanmu. 😊\n\n` +
    `Mau mulai dari mana? Balas *angka*-nya:\n` +
    `1️⃣  Periksa aktivasi _(sudah terdaftar di koperasi?)_\n` +
    `2️⃣  Belum ngerti koperasi\n` +
    `3️⃣  Menu\n` +
    `4️⃣  Ngobrol dengan asisten koperasi\n` +
    `5️⃣  Aktivasi Akun Anggota Koperasi _(daftar baru)_\n\n` +
    `_Sudah terdaftar? Pilih *1* buat cek & aktifkan akunmu. Belum punya akun? Pilih *5* buat daftar (kilat/demo atau form lengkap)._`
  );
}

/**
 * Nudge SINGKAT untuk memandu user mengetik "mulai" (first-touch / saat bingung).
 * Sengaja ringkas — tidak menampilkan seluruh menu, cukup ajakan command.
 */
export function startNudge(): string {
  return (
    `Halo! 👋 Selamat datang di layanan WhatsApp\n` +
    `*${koperasi.name}* 🇮🇩🏠\n\n` +
    `Aku asisten digitalmu, siap bantu kamu. 😊\n\n` +
    `Buat mulai, cukup ketik *mulai* ya! 🙌`
  );
}

/**
 * Caption welcome card sesuai status pengirim.
 * Prospek → sapaan onboarding; anggota → menu utama layanan.
 */
export function welcomeCaption(jid: string): string {
  return isMember(jid) ? mainMenu(getMember(jid)) : prospectWelcome();
}
