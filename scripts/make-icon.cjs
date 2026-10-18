/**
 * Generates build/icon.ico (256x256, PNG-compressed ICO) for the FloorCanvas
 * Windows build without requiring external image tooling.
 *
 * Usage: node scripts/make-icon.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 256;

const BLUE = [0x25, 0x63, 0xeb, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];

function drawRoundedRect(data, x0, y0, x1, y1, radius, color) {
  for (let y = Math.floor(y0); y < y1; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      // distance to the nearest corner
      const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius));
      const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius));
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (y * SIZE + x) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = color[3];
      }
    }
  }
}

function drawRect(data, x0, y0, x1, y1, color) {
  for (let y = Math.floor(y0); y < Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x < Math.floor(x1); x++) {
      const i = (y * SIZE + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xfffffffe;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // zero-filter scanlines
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const data = Buffer.alloc(SIZE * SIZE * 4, 0);

  // Buffer in "viewBox 48x48" coordinates scaled by s
  const s = SIZE / 48;
  const R = 9 * s;
  drawRoundedRect(data, 2 * s, 2 * s, 46 * s, 46 * s, R, [0, 0, 0, 0]); // clear canvas edges stay transparent
  drawRoundedRect(data, 2 * s, 2 * s, 46 * s, 46 * s, R, BLUE);

  const lw = 2.5 * s;
  // Inner plan outline (x 8..40, y 8..40)
  drawRect(data, 8 * s, 8 * s, 40 * s, 8 * s + lw, WHITE);
  drawRect(data, 8 * s, 40 * s - lw, 40 * s, 40 * s, WHITE);
  drawRect(data, 8 * s, 8 * s, 8 * s + lw, 40 * s, WHITE);
  drawRect(data, 40 * s - lw, 8 * s, 40 * s, 40 * s, WHITE);
  // Interior walls: vertical at x=24 (y 8..20), horizontal (24..40, y20), vertical (31,20..40)
  drawRect(data, 24 * s, 8 * s, 24 * s + lw, 20 * s, WHITE);
  drawRect(data, 24 * s, 20 * s, 40 * s, 20 * s + lw, WHITE);
  drawRect(data, 31 * s - lw / 2, 20 * s, 31 * s + lw / 2, 40 * s, WHITE);
  // Small fixture block
  drawRect(data, 12 * s, 26 * s, 19 * s, 31 * s, WHITE);

  const png = encodePng(data);

  // ICO wrapper: single 256px entry holding the PNG
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256 -> 0
  entry[1] = 0; // height 256 -> 0
  entry[2] = 0; // colors
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // data offset

  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'icon.ico');
  fs.writeFileSync(out, Buffer.concat([header, entry, png]));
  console.log(`Wrote ${out} (${fs.statSync(out).size} bytes)`);
}

main();
