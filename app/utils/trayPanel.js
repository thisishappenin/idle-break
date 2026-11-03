import { BrowserWindow, ipcMain, nativeTheme, screen } from 'electron'
import { trayPanelPosition } from './trayPanelPosition.js'

const WIDTH = 300
const MIN_HEIGHT = 120
const REOPEN_GUARD = 250

class TrayPanel {
  constructor ({ pagePath, preloadPath, getState, onAction }) {
    this.pagePath = pagePath
    this.preloadPath = preloadPath
    this.getState = getState
    this.onAction = onAction
    this.win = null
    this.loaded = false
    this.wantShow = false
    this.trayBounds = null
    this.hiddenAt = 0

    ipcMain.on('tray-panel-ready', (event) => {
      if (!this.isPanel(event)) return
      this.loaded = true
      this.push()
      if (this.wantShow) this.display()
    })
    ipcMain.on('tray-panel-action', (event, action) => {
      if (this.isPanel(event)) this.onAction(action)
    })
    ipcMain.on('tray-panel-height', (event, height) => {
      if (!this.isPanel(event) || !Number.isFinite(height)) return
      const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
      this.win.setSize(WIDTH, Math.round(Math.min(Math.max(height, MIN_HEIGHT), area.height - 16)))
      if (this.visible) this.place()
    })
  }

  isPanel (event) {
    return Boolean(this.win) && !this.win.isDestroyed() && event.sender === this.win.webContents
  }

  get visible () {
    return Boolean(this.win) && !this.win.isDestroyed() && this.win.isVisible()
  }

  toggle (trayBounds) {
    if (this.visible) {
      this.hide()
    } else if (Date.now() - this.hiddenAt > REOPEN_GUARD) {
      this.show(trayBounds)
    }
  }

  show (trayBounds) {
    this.trayBounds = trayBounds || null
    if (!this.win || this.win.isDestroyed()) this.create()
    if (this.loaded) {
      this.display()
    } else {
      this.wantShow = true
    }
  }

  hide () {
    this.wantShow = false
    if (this.visible) this.win.hide()
  }

  refresh () {
    if (this.visible) this.push()
  }

  destroy () {
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  create () {
    this.loaded = false
    const win = new BrowserWindow({
      width: WIDTH,
      height: 420,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      roundedCorners: true,
      title: 'Stretchly',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3',
      webPreferences: {
        preload: this.preloadPath,
        sandbox: false,
        backgroundThrottling: false
      }
    })
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.on('blur', () => this.hide())
    win.on('hide', () => { this.hiddenAt = Date.now() })
    win.on('closed', () => {
      if (this.win === win) this.win = null
      this.loaded = false
    })
    this.win = win
    win.loadURL('file://' + this.pagePath)
  }

  display () {
    this.wantShow = false
    this.push()
    this.place()
    this.win.show()
    this.win.focus()
  }

  push () {
    if (this.win && !this.win.isDestroyed() && this.loaded) {
      this.win.webContents.send('tray-panel-state', this.getState())
    }
  }

  place () {
    const [width, height] = this.win.getSize()
    const cursor = screen.getCursorScreenPoint()
    const hasBounds = this.trayBounds && this.trayBounds.width > 0
    const reference = hasBounds ? { x: this.trayBounds.x, y: this.trayBounds.y } : cursor
    const workArea = screen.getDisplayNearestPoint(reference).workArea
    const { x, y } = trayPanelPosition({ trayBounds: this.trayBounds, cursor, size: { width, height }, workArea })
    this.win.setPosition(x, y)
  }
}

export default TrayPanel
