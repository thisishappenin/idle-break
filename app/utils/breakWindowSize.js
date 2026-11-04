export const MIN_BREAK_WINDOW_WIDTH = 240
export const MIN_BREAK_WINDOW_HEIGHT = 80

const REFERENCE_DISPLAY_HEIGHT = 1080
const WIDEST_ASPECT_RATIO = 16 / 9
const MIN_SCALE = 1
const MAX_SCALE = 2
const FULL_WIDTH_FROM_RATIO = 0.85

export function breakWindowScale (displayHeight) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, displayHeight / REFERENCE_DISPLAY_HEIGHT))
}

export function breakWindowSize ({ displayWidth, displayHeight, widthRatio, heightRatio }) {
  const scale = breakWindowScale(displayHeight)
  const referenceWidth = Math.min(displayWidth, displayHeight * WIDEST_ASPECT_RATIO)
  const wantedWidth = referenceWidth * widthRatio +
    (displayWidth - referenceWidth) * Math.min(1, Math.max(0, (widthRatio - FULL_WIDTH_FROM_RATIO) / (1 - FULL_WIDTH_FROM_RATIO)))
  return {
    width: Math.min(displayWidth, Math.max(Math.round(MIN_BREAK_WINDOW_WIDTH * scale), Math.floor(wantedWidth))),
    height: Math.min(displayHeight, Math.max(Math.round(MIN_BREAK_WINDOW_HEIGHT * scale), Math.floor(displayHeight * heightRatio)))
  }
}
