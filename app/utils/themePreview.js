import { ICON_SIZES } from './trayNumberDrawer.js'

export function trayPreviewSize (devicePixelRatio) {
  const wanted = 16 * devicePixelRatio
  return ICON_SIZES.reduce((best, size) =>
    Math.abs(size - wanted) < Math.abs(best - wanted) ? size : best)
}
