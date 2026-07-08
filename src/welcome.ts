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
    `1️⃣  Belum ngerti koperasi\n` +
    `2️⃣  Menu\n` +
    `3️⃣  Ngobrol dengan asisten koperasi\n` +
    `4️⃣  Aktivasi Akun Anggota Koperasi\n\n` +
    `_Belum punya akun? Pilih *4* buat aktivasi kilat (demo). Ketik *aktivasi manual* buat isi form lengkap._`
  );
}

/**
 * Caption welcome card sesuai status pengirim.
 * Prospek → sapaan onboarding; anggota → menu utama layanan.
 */
export function welcomeCaption(jid: string): string {
  return isMember(jid) ? mainMenu(getMember(jid)) : prospectWelcome();
}
