const HEX = /^#[0-9a-f]{6}$/i

export function customColor (settings, name) {
  const color = settings.get(name)
  return settings.get(`${name}Custom`) && HEX.test(color) ? color : null
}

export const countdownColor = settings => customColor(settings, 'countdownColor')

export const trayNumberColor = settings => customColor(settings, 'trayNumberColor')

export function hexToRgb (hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16))
}
