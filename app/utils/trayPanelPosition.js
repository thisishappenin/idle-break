const MARGIN = 8

const clamp = (value, min, max) => Math.max(min, Math.min(value, max))

export function trayPanelPosition ({ trayBounds, cursor, size, workArea }) {
  const hasBounds = trayBounds && trayBounds.width > 0 && trayBounds.height > 0
  const anchor = hasBounds
    ? { x: trayBounds.x + trayBounds.width / 2, top: trayBounds.y, bottom: trayBounds.y + trayBounds.height }
    : { x: cursor.x, top: cursor.y, bottom: cursor.y }
  const left = workArea.x + MARGIN
  const right = workArea.x + workArea.width - size.width - MARGIN
  const top = workArea.y + MARGIN
  const bottom = workArea.y + workArea.height - size.height - MARGIN
  const trayAtTop = anchor.top < workArea.y + workArea.height / 2
  return {
    x: clamp(Math.round(anchor.x - size.width / 2), left, Math.max(left, right)),
    y: clamp(trayAtTop ? Math.round(anchor.bottom + MARGIN / 2) : bottom, top, Math.max(top, bottom))
  }
}
