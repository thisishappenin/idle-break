import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('trayPanel', {
  onState: (callback) => ipcRenderer.on('tray-panel-state', (_event, state) => callback(state)),
  ready: () => ipcRenderer.send('tray-panel-ready'),
  action: (action) => ipcRenderer.send('tray-panel-action', action),
  setHeight: (height) => ipcRenderer.send('tray-panel-height', height)
})
