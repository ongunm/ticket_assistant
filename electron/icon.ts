/**
 * Generates proper PNG tray icons using only Node built-ins (zlib).
 * No external image dependencies needed.
 */
import zlib from "node:zlib";

// ─── CRC32 (needed for PNG chunks) ─────────────────────────────────

const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PNG encoder ────────────────────────────────────────────────────

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const combined = Buffer.concat([typeBuffer, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([length, combined, crcBuf]);
}

function encodePNG(width: number, height: number, rgba: Uint8Array): Buffer {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: raw pixel rows with filter byte (0 = None) prepended
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * rowSize + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", iend),
  ]);
}

// ─── Icon drawing ───────────────────────────────────────────────────

type RGBA = [number, number, number, number];

function setPixel(data: Uint8Array, w: number, x: number, y: number, color: RGBA): void {
  const i = (y * w + x) * 4;
  data[i] = color[0];
  data[i + 1] = color[1];
  data[i + 2] = color[2];
  data[i + 3] = color[3];
}

function fillRect(
  data: Uint8Array,
  w: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  color: RGBA
): void {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      setPixel(data, w, x, y, color);
    }
  }
}

/**
 * Creates a 32x32 ticket/clipboard icon as a proper PNG buffer.
 * - Dark theme: light icon on transparent background
 * - macOS template mode: grayscale + alpha, system recolors automatically
 */
export function createTrayIconPNG(template: boolean): Buffer {
  const S = 32;
  const px = new Uint8Array(S * S * 4); // starts transparent

  // Colors
  const fg: RGBA = template ? [0, 0, 0, 200] : [230, 230, 240, 255];
  const fgDim: RGBA = template ? [0, 0, 0, 120] : [160, 160, 180, 255];
  const clip: RGBA = template ? [0, 0, 0, 255] : [124, 92, 252, 255];

  // Clipboard body (rounded-ish rectangle)
  fillRect(px, S, 6, 6, 20, 24, fg);

  // Clip at top center
  fillRect(px, S, 12, 3, 8, 5, clip);
  fillRect(px, S, 14, 2, 4, 2, clip);

  // Inner background (cut-out to make it look like a clipboard)
  const inner: RGBA = template ? [0, 0, 0, 0] : [26, 27, 30, 255];
  fillRect(px, S, 8, 9, 16, 19, inner);

  // Text lines inside
  fillRect(px, S, 10, 12, 12, 2, fgDim);
  fillRect(px, S, 10, 16, 10, 2, fgDim);
  fillRect(px, S, 10, 20, 12, 2, fgDim);
  fillRect(px, S, 10, 24, 7, 2, fgDim);

  return encodePNG(S, S, px);
}

/**
 * Creates a 16x16 version for macOS menu bar (smaller, crisper).
 */
export function createTrayIconPNG16(template: boolean): Buffer {
  const S = 16;
  const px = new Uint8Array(S * S * 4);

  const fg: RGBA = template ? [0, 0, 0, 200] : [230, 230, 240, 255];
  const fgDim: RGBA = template ? [0, 0, 0, 120] : [160, 160, 180, 255];
  const clip: RGBA = template ? [0, 0, 0, 255] : [124, 92, 252, 255];

  // Body
  fillRect(px, S, 3, 3, 10, 12, fg);

  // Clip
  fillRect(px, S, 6, 1, 4, 3, clip);

  // Inner cut-out
  const inner: RGBA = template ? [0, 0, 0, 0] : [26, 27, 30, 255];
  fillRect(px, S, 4, 5, 8, 9, inner);

  // Lines
  fillRect(px, S, 5, 6, 6, 1, fgDim);
  fillRect(px, S, 5, 8, 5, 1, fgDim);
  fillRect(px, S, 5, 10, 6, 1, fgDim);
  fillRect(px, S, 5, 12, 4, 1, fgDim);

  return encodePNG(S, S, px);
}
