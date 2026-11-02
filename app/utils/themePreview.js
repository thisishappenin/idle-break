import { isLightColor } from './colorContrast.js'
import { ICON_SIZES } from './trayNumberDrawer.js'

const CORNER_MARGIN = 3

export function previewWindowStyle ({ color, opacity, width, height, position }) {
  const light = isLightColor(color)
  const style = {
    width: `${width}%`,
    height: `${height}%`,
    background: color,
    opacity: String(opacity),
    color: light ? '#1b1b1b' : '#ffffff',
    outline: light
      ? 'color-mix(in srgb, #000000 30%, transparent)'
      : 'color-mix(in srgb, #ffffff 10%, transparent)',
    left: '',
    right: '',
    top: '',
    bottom: '',
    transform: ''
  }
  if (position === 'center') {
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%)'
    return style
  }
  const [vertical, horizontal] = position.split('-')
  style[vertical] = `${CORNER_MARGIN}%`
  style[horizontal] = `${CORNER_MARGIN}%`
  return style
}

export function isCompactWindow ({ screenWidth, screenHeight, width, height }) {
  return (screenWidth * width) / 100 <= 480 || (screenHeight * height) / 100 <= 320
}

export function trayPreviewSize (devicePixelRatio) {
  const wanted = 16 * devicePixelRatio
  return ICON_SIZES.reduce((best, size) =>
    Math.abs(size - wanted) < Math.abs(best - wanted) ? size : best)
}
