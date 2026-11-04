export const MIN_BREAK_WINDOW_WIDTH = 360
export const MIN_BREAK_WINDOW_HEIGHT = 120

const WIDEST_ASPECT_RATIO = 16 / 9

export function breakWindowSize ({ displayWidth, displayHeight, widthRatio, heightRatio }) {
  const referenceWidth = Math.min(displayWidth, displayHeight * WIDEST_ASPECT_RATIO)
  return {
    width: Math.min(displayWidth, Math.max(MIN_BREAK_WINDOW_WIDTH, Math.floor(referenceWidth * widthRatio))),
    height: Math.min(displayHeight, Math.max(MIN_BREAK_WINDOW_HEIGHT, Math.floor(displayHeight * heightRatio)))
  }
}
