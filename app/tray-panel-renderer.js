import formatClock from './utils/formatClock.js'
import { isLightColor } from './utils/colorContrast.js'

const panel = document.querySelector('#panel')
let state = null
let receivedAt = 0

function el (tag, props = {}, ...children) {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(props)) {
    if (name === 'class') node.className = value
    else if (name === 'text') node.textContent = value
    else if (name.startsWith('on')) node[name] = value
    else node.setAttribute(name, value)
  }
  node.append(...children)
  return node
}

const send = (type, extra = {}) => window.trayPanel.action({ type, ...extra })

function button (key, text, onclick, className = '') {
  return el('button', { type: 'button', 'data-key': key, class: className, text, onclick })
}

function remaining () {
  if (!state.countdown || state.countdown.ms === null) return null
  const elapsed = state.countdown.running ? Date.now() - receivedAt : 0
  return Math.max(0, state.countdown.ms - elapsed)
}

function minutesText (ms) {
  const minutes = ms === null ? '–' : Math.ceil(ms / 60000)
  return state.labels.minutes.replace('%d', minutes)
}

function section (...children) {
  return el('section', {}, ...children.filter(Boolean))
}

function applyTheme () {
  const root = document.documentElement
  root.classList.toggle('themed', Boolean(state.themeColor))
  if (state.themeColor) {
    root.style.setProperty('--theme-bg', state.themeColor)
    root.style.setProperty('--theme-ink', isLightColor(state.themeColor) ? '#1b1b1b' : '#ffffff')
  } else {
    root.style.removeProperty('--theme-bg')
    root.style.removeProperty('--theme-ink')
  }
  if (state.countdownColor) {
    root.style.setProperty('--countdown-color', state.countdownColor)
  } else {
    root.style.removeProperty('--countdown-color')
  }
}

function render () {
  const { labels } = state
  const focused = document.activeElement?.dataset?.key
  applyTheme()
  panel.replaceChildren()

  const ms = remaining()
  const meeting = state.meeting && el('div', { class: 'meeting' },
    el('span', { class: 'dot' }),
    el('span', { text: labels.inMeeting + (state.meeting.apps.length && !state.meeting.waiting ? ` \u00b7 ${state.meeting.apps.join(', ')}` : '') }))
  const header = section(
    meeting,
    ms !== null && el('div', { class: 'countdown' },
      el('span', { class: 'caption', text: labels.nextBreakIn }),
      el('span', { class: 'time', id: 'time', text: formatClock(ms) })),
    ...state.status.map(line => el('div', { class: 'status', text: line }))
  )
  if (header.children.length) panel.append(header)
  if (state.locked) return finish(focused)

  if (state.newVersion) {
    panel.append(section(button('download', labels.download, () => send('download'), 'primary')))
  }

  if (state.adjust) {
    const shorten = button('shorten', `\u2212${state.adjust.step}`, () => send('adjust', { direction: 'shorten' }))
    const extend = button('extend', `+${state.adjust.step}`, () => send('adjust', { direction: 'extend' }))
    shorten.setAttribute('aria-label', state.adjust.shorten)
    shorten.title = state.adjust.shorten
    extend.setAttribute('aria-label', state.adjust.extend)
    extend.title = state.adjust.extend
    panel.append(section(el('div', { class: 'stepper', title: `${labels.workSession}: ${labels.thisSessionOnly}` },
      shorten,
      el('span', { class: 'value', id: 'minutes', text: minutesText(ms) }),
      extend)))
  }

  const actions = [
    ...state.start.map(item => button(item.type, item.label, () => send(item.type))),
    state.reset && button('reset', labels.resetBreaks, () => send('reset'))
  ].filter(Boolean)
  if (state.paused) actions.push(button('resume', labels.resume, () => send('resume'), 'primary'))
  if (actions.length) panel.append(section(el('div', { class: 'grid2' }, ...actions)))

  if (state.pause) {
    const extras = [
      state.pause.morning && button('morning', labels.pauseUntilMorning, () => send('pauseUntilMorning')),
      state.pause.indefinitely && button('indefinitely', labels.pauseIndefinitely, () => send('pauseIndefinitely'))
    ].filter(Boolean)
    panel.append(section(
      el('div', { class: 'title', text: labels.pause }),
      el('div', { class: 'chips' }, ...state.pause.options.map(option => {
        const chip = button(`pause-${option.minutes}`, option.short, () => send('pause', { minutes: option.minutes }))
        chip.title = option.label
        chip.setAttribute('aria-label', option.label)
        return chip
      })),
      extras.length > 0 && el('div', { class: 'grid2' }, ...extras)
    ))
  }

  if (state.idle) {
    const input = el('input', { type: 'checkbox', role: 'switch', 'data-key': 'idle' })
    input.checked = state.idle.enabled
    input.onchange = () => send('toggleIdle', { value: input.checked })
    panel.append(section(el('label', { class: 'switch' },
      el('span', { text: labels.resetWhenIdle }), input, el('span', { class: 'switch-track' }))))
  }

  const footer = [section(
    state.contributor && el('div', { class: 'grid2' },
      button('contributor', labels.contributorPreferences, () => send('contributorPreferences')),
      button('sync', labels.syncPreferences, () => send('syncPreferences'))),
    el('div', { class: 'grid2' },
      button('preferences', labels.preferences, () => send('preferences')),
      button('quit', labels.quit, () => send('quit')))
  )]
  panel.append(...footer)
  finish(focused)
}

function finish (focused) {
  if (focused) panel.querySelector(`[data-key="${focused}"]`)?.focus()
  reportHeight()
}

function reportHeight () {
  window.trayPanel.setHeight(Math.ceil(panel.getBoundingClientRect().height))
}

function tick () {
  if (!state) return
  const ms = remaining()
  const time = document.querySelector('#time')
  if (time && ms !== null) time.textContent = formatClock(ms)
  const minutes = document.querySelector('#minutes')
  if (minutes) minutes.textContent = minutesText(ms)
}

window.trayPanel.onState((newState) => {
  state = newState
  receivedAt = Date.now()
  render()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') send('close')
})
setInterval(tick, 1000)
new window.ResizeObserver(reportHeight).observe(panel)
window.trayPanel.ready()
