const HEADER_SIZE = 6
const ENTRY_SIZE = 16
const INFO_HEADER_SIZE = 40

function encodeFrame ({ size, rgba }) {
  const maskRowBytes = Math.ceil(size / 32) * 4
  const pixelBytes = size * size * 4
  const maskBytes = maskRowBytes * size
  const frame = Buffer.alloc(INFO_HEADER_SIZE + pixelBytes + maskBytes)

  frame.writeUInt32LE(INFO_HEADER_SIZE, 0)
  frame.writeInt32LE(size, 4)
  frame.writeInt32LE(size * 2, 8)
  frame.writeUInt16LE(1, 12)
  frame.writeUInt16LE(32, 14)
  frame.writeUInt32LE(pixelBytes + maskBytes, 20)

  for (let y = 0; y < size; y++) {
    const sourceRow = (size - 1 - y) * size * 4
    for (let x = 0; x < size; x++) {
      const source = sourceRow + x * 4
      const target = INFO_HEADER_SIZE + (y * size + x) * 4
      frame[target] = rgba[source + 2]
      frame[target + 1] = rgba[source + 1]
      frame[target + 2] = rgba[source]
      frame[target + 3] = rgba[source + 3]
    }
  }
  return frame
}

export function encodeIco (frames) {
  const bodies = frames.map(encodeFrame)
  const header = Buffer.alloc(HEADER_SIZE + ENTRY_SIZE * frames.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  let offset = header.length
  frames.forEach(({ size }, index) => {
    const entry = HEADER_SIZE + index * ENTRY_SIZE
    header[entry] = size
    header[entry + 1] = size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(bodies[index].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += bodies[index].length
  })
  return Buffer.concat([header, ...bodies])
}
