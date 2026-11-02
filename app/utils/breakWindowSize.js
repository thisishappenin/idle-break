export const MIN_BREAK_WINDOW_WIDTH = 360
export const MIN_BREAK_WINDOW_HEIGHT = 120

export function breakWindowSize ({ displayWidth, displayHeight, widthRatio, heightRatio }) {
  return {
    width: Math.min(displayWidth, Math.max(MIN_BREAK_WINDOW_WIDTH, Math.floor(displayWidth * widthRatio))),
    height: Math.min(displayHeight, Math.max(MIN_BREAK_WINDOW_HEIGHT, Math.floor(displayHeight * heightRatio)))
  }
}
