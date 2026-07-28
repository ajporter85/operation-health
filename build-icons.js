/*
 * build-icons.js  —  dev tooling, run with `node build-icons.js`
 *
 * Generates the home-screen icon set with ZERO dependencies (hand-rolled PNG
 * encoder over Node's built-in zlib). A teal (#0f766e, the app theme color)
 * full-bleed square with a white health "plus" centered well inside the maskable
 * safe zone, so iOS/Android can mask the corners without clipping the mark.
 *
 * Outputs (repo root, referenced with relative paths so they work under the
 * GitHub Pages /operation-health/ subpath):
 *   apple-touch-icon.png  180x180  (the one iOS uses for Add to Home Screen)
 *   icon-192.png          192x192  (manifest)
 *   icon-512.png          512x512  (manifest)
 *
 * Rebrand later by editing BG / FG / the plus geometry and re-running.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var BG = [0x0f, 0x76, 0x6e]; // theme teal
var FG = [0xff, 0xff, 0xff]; // white mark

// CRC32 (PNG chunk checksum).
var CRC_TABLE = (function () {
  var t = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  var c = 0xffffffff;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32(n) {
  var b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b;
}
function chunk(type, data) {
  var typeBuf = Buffer.from(type, 'ascii');
  var body = Buffer.concat([typeBuf, data]);
  return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}

function drawPlus(size) {
  // Raw RGB scanlines, each prefixed with a filter byte (0 = None).
  var t = Math.round(size * 0.085);          // half-thickness of the plus arms
  var lo = Math.round(size * 0.24), hi = size - lo; // arm extent (well inside safe zone)
  var cx = size / 2, cy = size / 2;
  var raw = Buffer.alloc((size * 3 + 1) * size);
  var p = 0;
  for (var y = 0; y < size; y++) {
    raw[p++] = 0; // filter: None
    var inV = (y >= lo && y <= hi);
    var inHrow = (y >= cy - t && y <= cy + t);
    for (var x = 0; x < size; x++) {
      var vert = inV && (x >= cx - t && x <= cx + t);
      var horz = inHrow && (x >= lo && x <= hi);
      var col = (vert || horz) ? FG : BG;
      raw[p++] = col[0]; raw[p++] = col[1]; raw[p++] = col[2];
    }
  }
  return raw;
}

function png(size) {
  var sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var ihdr = Buffer.concat([
    u32(size), u32(size),
    Buffer.from([8, 2, 0, 0, 0]) // 8-bit, colortype 2 (RGB), deflate, filter, no interlace
  ]);
  var idat = zlib.deflateSync(drawPlus(size), { level: 9 });
  return Buffer.concat([
    sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
}

var OUT = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512]
];
OUT.forEach(function (o) {
  var file = path.join(__dirname, o[0]);
  fs.writeFileSync(file, png(o[1]));
  console.log('wrote ' + o[0] + '  (' + o[1] + 'x' + o[1] + ', ' + fs.statSync(file).size + ' bytes)');
});
