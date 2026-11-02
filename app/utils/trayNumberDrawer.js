export const BUNDLED_FONT = 'DejaVu Sans'
export const ICON_SIZES = [16, 20, 24, 32, 40, 48]

const SUPERSAMPLE = 8
const CRISP_THRESHOLD = 0.45
const REFERENCE_FONT_SIZE = 100
const TWO_DIGIT_WIDTH_RATIO = 15 / 16

let bundledFontLoaded = null

function loadBundledFont () {
  if (!bundledFontLoaded) {
    const face = new window.FontFace(BUNDLED_FONT, 'url(fonts/DejaVuSans-Bold.ttf)', { weight: 'bold' })
    bundledFontLoaded = face.load().then(loaded => document.fonts.add(loaded))
  }
  return bundledFontLoaded
}

function measure (ctx, text, fontSize, fontFamily) {
  ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
  return ctx.measureText(text)
}

function drawNumber ({ text, fontFamily, color, size, crisp, heightRatio }) {
  const big = size * SUPERSAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = big
  canvas.height = big
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  const digit = measure(ctx, '0', REFERENCE_FONT_SIZE, fontFamily)
  const digitHeight = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent
  const targetHeight = Math.max(4, Math.round(size * heightRatio))
  const fontSize = REFERENCE_FONT_SIZE * (targetHeight * SUPERSAMPLE) / digitHeight

  const twoDigits = measure(ctx, '00', fontSize, fontFamily)
  const twoDigitsWidth = twoDigits.actualBoundingBoxLeft + twoDigits.actualBoundingBoxRight
  const squeeze = Math.min(1, (size * TWO_DIGIT_WIDTH_RATIO * SUPERSAMPLE) / twoDigitsWidth)

  const ink = measure(ctx, text, fontSize, fontFamily)
  const inkWidth = (ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight) * squeeze
  const left = Math.round((size - inkWidth / SUPERSAMPLE) / 2)
  const top = Math.round((size - targetHeight) / 2)

  ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'alphabetic'
  ctx.scale(squeeze, 1)
  ctx.fillText(
    text,
    (left * SUPERSAMPLE) / squeeze + ink.actualBoundingBoxLeft,
    top * SUPERSAMPLE + ink.actualBoundingBoxAscent
  )

  const source = ctx.getImageData(0, 0, big, big).data
  const rgba = new Uint8ClampedArray(size * size * 4)
  const [red, green, blue] = color
  const samples = SUPERSAMPLE * SUPERSAMPLE
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let total = 0
      for (let dy = 0; dy < SUPERSAMPLE; dy++) {
        const row = ((y * SUPERSAMPLE + dy) * big + x * SUPERSAMPLE) * 4
        for (let dx = 0; dx < SUPERSAMPLE; dx++) total += source[row + dx * 4 + 3]
      }
      const coverage = total / samples / 255
      const target = (y * size + x) * 4
      rgba[target] = red
      rgba[target + 1] = green
      rgba[target + 2] = blue
      rgba[target + 3] = crisp ? (coverage >= CRISP_THRESHOLD ? 255 : 0) : Math.round(coverage * 255)
    }
  }
  return rgba
}

export async function drawTrayNumber ({ text, fontFamily, color, crisp = false, heightRatio = 0.5, sizes = ICON_SIZES }) {
  if (fontFamily === BUNDLED_FONT) await loadBundledFont()
  await document.fonts.load(`bold 100px "${fontFamily}"`, text)
  return sizes.map(size => ({
    size,
    rgba: drawNumber({ text, fontFamily, color, size, crisp, heightRatio })
  }))
}
