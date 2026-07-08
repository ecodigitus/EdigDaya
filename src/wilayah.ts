/**
 * Data wilayah DUMMY untuk cascade dropdown aktivasi (Provinsi → Kabupaten/Kota
 * → Kecamatan → Desa/Kelurahan → Koperasi).
 *
 * PRODUKSI: ganti sumber data ini dengan hasil query ke SIMKOPDES (mis. endpoint
 * daftar wilayah & koperasi). Struktur helper di bawah sengaja dibuat sederhana
 * agar mudah ditukar ke pemanggilan API.
 */
type Desa = Record<string, string[]>; // desa/kelurahan -> daftar koperasi
type Kecamatan = Record<string, Desa>;
type Kabupaten = Record<string, Kecamatan>;
type Provinsi = Record<string, Kabupaten>;

export const WILAYAH: Provinsi = {
  'Jawa Barat': {
    'Kabupaten Bogor': {
      Cibinong: {
        Sukamaju: ['Koperasi Merah Putih Desa Sukamaju', 'Koperasi Serba Usaha Sukamaju'],
        'Harapan Jaya': ['Koperasi Merah Putih Harapan Jaya'],
      },
      Cileungsi: {
        'Cileungsi Kidul': ['Koperasi Merah Putih Cileungsi Kidul'],
      },
    },
    'Kota Bandung': {
      Coblong: {
        Dago: ['Koperasi Merah Putih Dago'],
      },
    },
  },
  'Jawa Tengah': {
    'Kabupaten Semarang': {
      'Ungaran Barat': {
        Langensari: ['Koperasi Merah Putih Langensari'],
      },
    },
  },
};

export function listProvinsi(): string[] {
  return Object.keys(WILAYAH);
}
export function listKabupaten(prov: string): string[] {
  return Object.keys(WILAYAH[prov] ?? {});
}
export function listKecamatan(prov: string, kab: string): string[] {
  return Object.keys(WILAYAH[prov]?.[kab] ?? {});
}
export function listDesa(prov: string, kab: string, kec: string): string[] {
  return Object.keys(WILAYAH[prov]?.[kab]?.[kec] ?? {});
}
export function listKoperasi(prov: string, kab: string, kec: string, desa: string): string[] {
  return WILAYAH[prov]?.[kab]?.[kec]?.[desa] ?? [];
}
