import { describe, it } from 'vitest'
import { expect } from 'chai'
import { encodeIco } from '../app/utils/icoEncoder.js'

function solid (size, [red, green, blue, alpha]) {
  const rgba = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) rgba.set([red, green, blue, alpha], i * 4)
  return { size, rgba }
}

describe('icoEncoder', () => {
  it('writes the icon header and one directory entry per frame', () => {
    const ico = encodeIco([solid(16, [0, 0, 0, 255]), solid(24, [0, 0, 0, 255])])
    expect(ico.readUInt16LE(0)).to.equal(0)
    expect(ico.readUInt16LE(2)).to.equal(1)
    expect(ico.readUInt16LE(4)).to.equal(2)
    expect(ico[6]).to.equal(16)
    expect(ico[7]).to.equal(16)
    expect(ico[22]).to.equal(24)
    expect(ico[23]).to.equal(24)
  })

  it('points each directory entry at its image data', () => {
    const ico = encodeIco([solid(16, [0, 0, 0, 255]), solid(20, [0, 0, 0, 255])])
    ;[6, 22].forEach(entry => {
      const length = ico.readUInt32LE(entry + 8)
      const offset = ico.readUInt32LE(entry + 12)
      expect(ico.readUInt32LE(offset)).to.equal(40)
      expect(offset + length).to.be.at.most(ico.length)
    })
    const last = ico.readUInt32LE(22 + 12) + ico.readUInt32LE(22 + 8)
    expect(last).to.equal(ico.length)
  })

  it('stores 32-bit pixels as bottom-up BGRA', () => {
    const rgba = new Uint8Array(16 * 16 * 4)
    rgba.set([10, 20, 30, 255], 0)
    rgba.set([40, 50, 60, 128], (15 * 16 + 15) * 4)
    const ico = encodeIco([{ size: 16, rgba }])
    const offset = ico.readUInt32LE(18)
    const pixels = offset + 40
    expect(ico.readInt32LE(offset + 8)).to.equal(32)
    expect([...ico.subarray(pixels + 15 * 16 * 4, pixels + 15 * 16 * 4 + 4)]).to.deep.equal([30, 20, 10, 255])
    expect([...ico.subarray(pixels + 15 * 4, pixels + 15 * 4 + 4)]).to.deep.equal([60, 50, 40, 128])
  })

  it('adds an empty AND mask after the pixels', () => {
    const ico = encodeIco([solid(20, [1, 2, 3, 255])])
    const length = ico.readUInt32LE(14)
    expect(length).to.equal(40 + 20 * 20 * 4 + 4 * 20)
    expect(ico.subarray(ico.length - 80).every(byte => byte === 0)).to.equal(true)
  })
})
