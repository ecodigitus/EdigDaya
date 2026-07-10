/** Format angka ke Rupiah (mirror src/format.ts di bot). */
export function rupiah(n: number | null | undefined): string {
  return 'Rp' + (n ?? 0).toLocaleString('id-ID');
}

export function angka(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('id-ID');
}
