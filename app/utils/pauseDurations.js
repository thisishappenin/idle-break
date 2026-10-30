const MAX_MINUTES = 7 * 24 * 60

export function parsePauseDurations (text) {
  const minutes = String(text).split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter(value => Number.isInteger(value) && value > 0 && value <= MAX_MINUTES)
  return [...new Set(minutes)].sort((a, b) => a - b)
}

export function formatPauseDurations (minutes) {
  return minutes.join(', ')
}
