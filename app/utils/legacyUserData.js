import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const COPIED = ['config.json', 'images', 'audio']

function migrateLegacyUserData (from, to) {
  if (!existsSync(join(from, 'config.json')) || existsSync(join(to, 'config.json'))) return []
  const copied = COPIED.filter(name => existsSync(join(from, name)))
  for (const name of copied) {
    cpSync(join(from, name), join(to, name), { recursive: true })
  }
  return copied
}

export { migrateLegacyUserData }
