import qrcode from "qrcode-generator";

/** Inline SVG string encoding `text` (QR, error-correction level M). */
export function qrSvg(text: string, cellSize = 4, margin = 0): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin });
}

/**
 * QR as a base64 data URL for use in <img src>. Preferred over injecting SVG via
 * dangerouslySetInnerHTML — React then manages a single leaf node (no manual DOM
 * mutation that can trip reconciliation / removeChild errors).
 */
export function qrDataUrl(text: string, cellSize = 4, margin = 0): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize, margin);
}
