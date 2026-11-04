export function parseEntryList (text) {
  const seen = new Set()
  const entries = []
  for (const part of String(text).split(/[\r\n,]+/)) {
    const entry = part.trim()
    const key = entry.toLowerCase()
    if (entry && !seen.has(key)) {
      seen.add(key)
      entries.push(entry)
    }
  }
  return entries
}

export function formatEntryList (entries) {
  return entries.length ? entries.join('\n') + '\n' : ''
}
