const idr = new Intl.NumberFormat('id-ID');

/** Format angka jadi Rupiah. Contoh: 1500000 -> "Rp1.500.000". */
export function rupiah(n: number): string {
  return 'Rp' + idr.format(n);
}
