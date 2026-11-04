export const DISPLAY_PROFILE_KEYS = ['breakWindowPosition', 'breakWindowWidth', 'breakWindowHeight']

export function displayProfileKey (display) {
  return `${display.bounds.width}x${display.bounds.height}@${display.scaleFactor}`
}

export function saveDisplayProfile (settings, key) {
  const profiles = { ...settings.get('breakWindowProfiles') }
  profiles[key] = Object.fromEntries(DISPLAY_PROFILE_KEYS.map(name => [name, settings.get(name)]))
  settings.set('breakWindowProfiles', profiles)
}

export function applyDisplayProfile (settings, key) {
  const profile = settings.get('breakWindowProfiles')?.[key]
  if (!profile) return false
  let changed = false
  for (const name of DISPLAY_PROFILE_KEYS) {
    if (name in profile && settings.get(name) !== profile[name]) {
      settings.set(name, profile[name])
      changed = true
    }
  }
  return changed
}
