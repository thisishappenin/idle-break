const HEX = /^#[0-9a-f]{6}$/i

export function countdownColor (settings) {
  const color = settings.get('countdownColor')
  return settings.get('countdownColorCustom') && HEX.test(color) ? color : null
}

export function hexToRgb (hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16))
}
