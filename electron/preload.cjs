const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  resetPrompts: () => ipcRenderer.invoke("settings:resetPrompts"),
  copyToClipboard: (text) => ipcRenderer.invoke("clipboard:write", text),
  speak: (text) => ipcRenderer.invoke("tts:speak", text),
  stopSpeaking: () => ipcRenderer.invoke("tts:stop"),
  onHotkey: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("hotkey", handler);
    return () => ipcRenderer.removeListener("hotkey", handler);
  },
  bringToFront: () => ipcRenderer.invoke("app:bringToFront"),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  
  // Project management
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    create: (data) => ipcRenderer.invoke("projects:create", data),
    save: (projectId, data) => ipcRenderer.invoke("projects:save", projectId, data),
    saveAudio: (projectId, audioData, segmentIndex) => ipcRenderer.invoke("projects:saveAudio", projectId, audioData, segmentIndex),
    load: (projectId) => ipcRenderer.invoke("projects:load", projectId),
    rename: (projectId, newName) => ipcRenderer.invoke("projects:rename", projectId, newName),
    delete: (projectId) => ipcRenderer.invoke("projects:delete", projectId),
    getAudioPath: (projectId, audioFile) => ipcRenderer.invoke("projects:getAudioPath", projectId, audioFile),
    getDir: () => ipcRenderer.invoke("projects:getDir"),
    openFolder: (projectId) => ipcRenderer.invoke("projects:openFolder", projectId),
    selectDir: () => ipcRenderer.invoke("projects:selectDir"),
    download: (projectId) => ipcRenderer.invoke("projects:download", projectId),
    upload: () => ipcRenderer.invoke("projects:upload"),
  },
});
