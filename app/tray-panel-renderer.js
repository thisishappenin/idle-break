import formatClock from './utils/formatClock.js'

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

function render () {
  const { labels } = state
  const focused = document.activeElement?.dataset?.key
  panel.replaceChildren()

  const ms = remaining()
  const header = section(
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
    panel.append(section(
      el('div', { class: 'title', text: labels.workSession }),
      el('div', { class: 'stepper' },
        button('shorten', `−${state.adjust.step}`, () => send('adjust', { direction: 'shorten' })),
        el('span', { class: 'value', id: 'minutes', text: minutesText(ms) }),
        button('extend', `+${state.adjust.step}`, () => send('adjust', { direction: 'extend' }))),
      el('div', { class: 'muted', text: labels.thisSessionOnly })
    ))
    const [shorten, extend] = panel.querySelectorAll('.stepper button')
    shorten.setAttribute('aria-label', state.adjust.shorten)
    shorten.title = state.adjust.shorten
    extend.setAttribute('aria-label', state.adjust.extend)
    extend.title = state.adjust.extend
  }

  if (state.start.length) {
    panel.append(section(el('div', { class: 'list' },
      ...state.start.map(item => button(item.type, item.label, () => send(item.type))))))
  }

  if (state.paused) {
    panel.append(section(button('resume', labels.resume, () => send('resume'), 'primary')))
  } else if (state.pause) {
    panel.append(section(
      el('div', { class: 'title', text: labels.pause }),
      el('div', { class: 'chips' },
        ...state.pause.options.map(option => button(`pause-${option.minutes}`, option.label, () => send('pause', { minutes: option.minutes })))),
      state.pause.morning && button('morning', labels.pauseUntilMorning, () => send('pauseUntilMorning')),
      state.pause.indefinitely && button('indefinitely', labels.pauseIndefinitely, () => send('pauseIndefinitely')),
      state.reset && button('reset', labels.resetBreaks, () => send('reset'))
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
    state.contributor && el('div', { class: 'list' },
      button('contributor', labels.contributorPreferences, () => send('contributorPreferences')),
      button('sync', labels.syncPreferences, () => send('syncPreferences'))),
    el('div', { class: 'footer' },
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
window.trayPanel.ready()
