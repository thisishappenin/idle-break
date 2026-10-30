import { isLightColor } from './utils/colorContrast.js'

const params = new URLSearchParams(window.location.search)
document.getElementById('message').textContent = params.get('message')
const background = params.get('background')
if (background) {
  document.documentElement.style.setProperty('--idle-bg', background)
  if (isLightColor(background.slice(0, 7))) document.body.classList.add('ffffff')
}
const undo = document.getElementById('undo')
undo.textContent = params.get('undo')
undo.addEventListener('click', () => window.idleReset.undo())
