import { isLightColor } from './utils/colorContrast.js'

const params = new URLSearchParams(window.location.search)
const root = document.documentElement
document.getElementById('message').textContent = params.get('message')

const background = params.get('background')
if (background) {
  root.style.setProperty('--toast-bg', background)
  if (isLightColor(background.slice(0, 7))) document.body.classList.add('light')
}
root.style.setProperty('--toast-duration', `${Number(params.get('duration')) || 10000}ms`)

const action = document.getElementById('action')
if (params.get('action')) {
  action.textContent = params.get('action')
  action.hidden = false
  action.addEventListener('click', event => {
    event.stopPropagation()
    window.toast.action()
  })
}

document.body.addEventListener('click', () => window.toast.dismiss())
