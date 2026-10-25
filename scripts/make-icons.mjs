// Generates plain placeholder PNG icons (dumbbell on dark background) with no dependencies.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}

function png(size, scale) {
  const bg = [15, 23, 42]
  const fg = [56, 189, 248]
  const rects = [
    [96, 232, 416, 280],
    [64, 176, 112, 336],
    [400, 176, 448, 336],
  ]
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      // map pixel into 512 space, shrinking the artwork by `scale` around the centre
      const ux = (x / size - 0.5) / scale * 512 + 256
      const uy = (y / size - 0.5) / scale * 512 + 256
      const on = rects.some(([x0, y0, x1, y1]) => ux >= x0 && ux < x1 && uy >= y0 && uy < y1)
      const [r, g, b] = on ? fg : bg
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', png(192, 1))
writeFileSync('public/icon-512.png', png(512, 1))
// maskable: keep artwork inside the central safe zone
writeFileSync('public/icon-maskable-512.png', png(512, 0.7))
console.log('icons written')
