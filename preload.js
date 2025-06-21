/*
=====================================================
    2. File Name: preload.js
=====================================================
*/
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Main -> Renderer (Events sent from the main process)
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', callback),
    onDownloadError: (callback) => ipcRenderer.on('download-error', callback),

    // Renderer -> Main (Functions the renderer can call)
    fetchVideoInfo: (url) => ipcRenderer.invoke('fetch-video-info', url),
    downloadVideo: (options) => ipcRenderer.send('download-video', options),
    getSetting: (key, defaultValue) => ipcRenderer.invoke('get-setting', key, defaultValue),
    setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
});