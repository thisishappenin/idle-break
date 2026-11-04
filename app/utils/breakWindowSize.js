export const MIN_BREAK_WINDOW_WIDTH = 360
export const MIN_BREAK_WINDOW_HEIGHT = 120

const REFERENCE_DISPLAY_HEIGHT = 1080
const WIDEST_ASPECT_RATIO = 16 / 9
const MIN_SCALE = 0.9
const MAX_SCALE = 2

export function breakWindowScale (displayHeight) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, displayHeight / REFERENCE_DISPLAY_HEIGHT))
}

export function breakWindowSize ({ displayWidth, displayHeight, widthRatio, heightRatio }) {
  const scale = breakWindowScale(displayHeight)
  const referenceWidth = Math.min(displayWidth, displayHeight * WIDEST_ASPECT_RATIO)
  return {
    width: Math.min(displayWidth, Math.max(Math.round(MIN_BREAK_WINDOW_WIDTH * scale), Math.floor(referenceWidth * widthRatio))),
    height: Math.min(displayHeight, Math.max(Math.round(MIN_BREAK_WINDOW_HEIGHT * scale), Math.floor(displayHeight * heightRatio)))
  }
}
