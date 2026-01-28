const { app, BrowserWindow, globalShortcut, ipcMain, shell, session, systemPreferences, dialog, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const Store = require("electron-store");
// Server port
const serverPort = 3000;

// Register custom protocol for serving audio files
protocol.registerSchemesAsPrivileged([
  { scheme: 'audio-file', privileges: { secure: true, supportFetchAPI: true, stream: true } }
]);

// Get the default transcriptions directory
function getTranscriptionsDir() {
  // Use app's userData folder for persistence
  return path.join(app.getPath("userData"), "Transcriptions");
}

// Ensure the transcriptions directory exists
async function ensureTranscriptionsDir() {
  const dir = getTranscriptionsDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error("Failed to create transcriptions dir:", err);
  }
  return dir;
}

// Disable GPU features that can cause audio crashes
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-software-rasterizer");
// Use a different audio backend that's more stable
app.commandLine.appendSwitch("enable-features", "AudioServiceOutOfProcess");

// Request microphone permission on macOS
async function requestMicrophonePermission() {
  if (process.platform === "darwin") {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    console.log("Microphone permission status:", status);
    
    if (status !== "granted") {
      const granted = await systemPreferences.askForMediaAccess("microphone");
      console.log("Microphone permission granted:", granted);
      return granted;
    }
    return true;
  }
  return true; // Non-macOS platforms
}

// Default prompts for each mode
const defaultPrompts = {
  note: `Mache aus dem Transkript eine strukturierte Notiz.
Gib das Ergebnis im gewählten Format zurück:
- Für Markdown: mit # Titel, ## Key points, ## Details, ## Next steps, ## Tags
- Für HTML: mit <h1>, <h2>, <p>, <ul> Tags
- Für Text: mit klaren Absätzen und Aufzählungen`,
  meeting: `Du bist ein Assistent, der Roh-Transkripte in saubere Meeting Minutes umwandelt.
Gib das Ergebnis im gewählten Format zurück mit:
- Titel
- Summary (3-6 Bulletpoints)
- Entscheidungen
- Action Items
- Offene Fragen
- Fakten/Zahlen`,
  tasks: `Extrahiere Aufgaben aus dem Transkript.
Gib das Ergebnis im gewählten Format zurück:
- Tasks (mit Checkboxen wenn möglich)
- Jede Aufgabe mit Datum, falls erwähnt
- Kontext (2-5 Bulletpoints)`,
  email: `Formuliere aus dem Transkript eine professionelle E-Mail auf Deutsch (Sie).
Gib das Ergebnis im gewählten Format zurück:
- Betreff
- E-Mail Text`,
  custom: `Verarbeite das Transkript nach den folgenden Anweisungen.
Gib das Ergebnis klar strukturiert zurück.`
};

const store = new Store({
  name: "settings",
  defaults: {
    sttProvider: "whisper-local",
    whisperModel: "Xenova/whisper-base",
    whisperApiKey: "",
    llmProvider: "ollama",
    llmModel: "llama3.2:3b",
    llmApiKey: "",
    ollamaBaseUrl: "http://localhost:11434",
    language: "de-DE",
    hotkey: process.platform === "darwin" ? "CommandOrControl+Shift+Space" : "Control+Shift+Space",
    outputFormat: "markdown",
    prompts: defaultPrompts,
    customPromptInstructions: "",
  },
});

let mainWindow;

// Check if running in production (packaged app)
function isProduction() {
  return app.isPackaged;
}

// Start the Next.js server for production
async function startNextServer() {
  if (!isProduction()) {
    console.log("Development mode - using external dev server");
    return `http://localhost:${serverPort}`;
  }
  
  console.log("Production mode - starting integrated server...");
  
  // Find the standalone server directory
  const standaloneDir = path.join(process.resourcesPath, ".next", "standalone");
  const serverPath = path.join(standaloneDir, "server.js");
  
  if (!fsSync.existsSync(serverPath)) {
    console.error("Standalone server not found at:", serverPath);
    dialog.showErrorBox("Server Error", `Server not found at: ${serverPath}`);
    return `http://localhost:${serverPort}`;
  }
  
  console.log("Loading server from:", serverPath);
  
  // Set environment variables for Next.js
  process.env.PORT = String(serverPort);
  process.env.NODE_ENV = "production";
  process.env.HOSTNAME = "localhost";
  
  // Change to standalone directory so Next.js can find its files
  const originalCwd = process.cwd();
  process.chdir(standaloneDir);
  
  return new Promise((resolve) => {
    try {
      // Load and run the server directly in Electron's Node.js
      require(serverPath);
      console.log("Next.js server loaded, waiting for startup...");
      
      // Wait a bit for the server to start, then resolve
      setTimeout(() => {
        console.log("Server should be ready on port", serverPort);
        resolve(`http://localhost:${serverPort}`);
      }, 2000);
    } catch (err) {
      console.error("Failed to load server:", err);
      process.chdir(originalCwd);
      dialog.showErrorBox("Server Error", `Failed to start server: ${err.message}`);
      resolve(`http://localhost:${serverPort}`);
    }
  });
}

function createWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#0a0a0f",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const startUrl = serverUrl || process.env.ELECTRON_START_URL || `http://localhost:${serverPort}`;
  console.log("Loading URL:", startUrl);
  mainWindow.loadURL(startUrl);

  let hasShown = false;
  const showWindow = () => {
    if (hasShown) return;
    hasShown = true;
    mainWindow.show();
  };

  // Fallback: Fenster nach 10s anzeigen, falls ready-to-show nie kommt (hängender Renderer, weiße Seite, etc.)
  const showTimeout = setTimeout(() => {
    console.warn("ready-to-show did not fire within 10s, showing window anyway");
    showWindow();
  }, 10000);

  mainWindow.once("ready-to-show", () => {
    clearTimeout(showTimeout);
    showWindow();
  });

  // Bei Load-Fehler (z.B. localhost:3000 nicht erreichbar): Fenster trotzdem anzeigen, Nutzer sieht Fehlerseite oder kann Reload versuchen
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.error("Main frame failed to load:", errorCode, errorDescription, validatedURL);
      showWindow();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Crash detection and logging
  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("RENDERER CRASH:", details.reason, details.exitCode);
    dialog.showErrorBox(
      "Renderer Crashed", 
      `Reason: ${details.reason}\nExit Code: ${details.exitCode}\n\nThe app will reload.`
    );
    mainWindow.loadURL(startUrl);
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.error("RENDERER UNRESPONSIVE");
  });

  mainWindow.webContents.on("responsive", () => {
    console.log("Renderer responsive again");
  });

  // Log console messages from renderer
  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    const levels = ["verbose", "info", "warning", "error"];
    console.log(`[Renderer ${levels[level] || level}] ${message}`);
  });
}

function registerHotkey() {
  const hotkey = store.get("hotkey");
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(hotkey, () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("hotkey");
    }
  });
  if (!ok) {
    console.warn("Hotkey registration failed:", hotkey);
  }
}

// Setup permissions for microphone access and speech recognition
function setupPermissions() {
  // Grant microphone and speech recognition permissions automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "microphone", "audioCapture", "speech-recognition"];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Also handle permission checks
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowedPermissions = ["media", "microphone", "audioCapture", "speech-recognition"];
    if (allowedPermissions.includes(permission)) {
      return true;
    }
    return false;
  });

  // Allow connections to Google's speech recognition servers
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://www.google.com/*", "*://*.googleapis.com/*", "*://speech.google.com/*"] },
    (details, callback) => {
      callback({ requestHeaders: details.requestHeaders });
    }
  );
}

app.whenReady().then(async () => {
  // Register custom protocol for audio files with Range Request support
  protocol.handle('audio-file', async (request) => {
    try {
      // URL format: audio-file://projectId/audio/segment_0000.webm
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      if (pathParts.length < 2) {
        return new Response('Invalid path', { status: 400 });
      }
      
      // Reconstruct the file path
      const projectId = url.hostname;
      const relativePath = pathParts.join('/');
      const dir = getTranscriptionsDir();
      const filePath = path.join(dir, projectId, relativePath);
      
      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        console.error('audio-file protocol: file not found', filePath);
        return new Response('File not found', { status: 404 });
      }
      
      // Get file stats for size
      const stat = fsSync.statSync(filePath);
      const fileSize = stat.size;
      
      // Check for Range header
      const rangeHeader = request.headers.get('Range');
      
      if (rangeHeader) {
        // Parse Range header (e.g., "bytes=0-1023")
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          
          console.log('audio-file protocol: Range request', start, '-', end, 'of', fileSize);
          
          // Read only the requested range
          const fd = fsSync.openSync(filePath, 'r');
          const buffer = Buffer.alloc(chunkSize);
          fsSync.readSync(fd, buffer, 0, chunkSize, start);
          fsSync.closeSync(fd);
          
          return new Response(buffer, {
            status: 206,
            headers: {
              'Content-Type': 'audio/webm',
              'Content-Length': chunkSize.toString(),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes'
            }
          });
        }
      }
      
      // No Range header - return full file
      console.log('audio-file protocol: serving full file', filePath, 'size:', fileSize);
      const data = await fs.readFile(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': 'audio/webm',
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes'
        }
      });
    } catch (err) {
      console.error('audio-file protocol error:', err);
      return new Response('Error loading file', { status: 500 });
    }
  });

  // Request microphone permission on macOS (triggers system dialog)
  await requestMicrophonePermission();
  
  setupPermissions();
  
  // Create application menu with Speech submenu (for native TTS)
  const { Menu } = require("electron");
  const isMac = process.platform === "darwin";
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    }] : []),
    // Edit menu with Speech
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        ...(isMac ? [
          { type: "separator" },
          {
            label: "Speech",
            submenu: [
              { role: "startSpeaking", label: "Start Speaking" },
              { role: "stopSpeaking", label: "Stop Speaking" }
            ]
          }
        ] : [])
      ]
    },
    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [
          { type: "separator" },
          { role: "front" }
        ] : [
          { role: "close" }
        ])
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // Start the Next.js server and then create window
  const serverUrl = await startNextServer();
  createWindow(serverUrl);
  registerHotkey();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverUrl);
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("settings:get", async () => store.store);
ipcMain.handle("settings:save", async (_evt, partial) => {
  const current = store.store;
  const next = { ...current, ...partial };
  store.store = next;
  if (partial && Object.prototype.hasOwnProperty.call(partial, "hotkey")) {
    registerHotkey();
  }
  return store.store;
});

ipcMain.handle("settings:resetPrompts", async () => {
  store.set("prompts", defaultPrompts);
  store.set("customPromptInstructions", "");
  return store.store;
});

ipcMain.handle("app:bringToFront", async () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.handle("app:openExternal", async (_evt, url) => {
  await shell.openExternal(url);
});

// Clipboard
ipcMain.handle("clipboard:write", async (_evt, text) => {
  const { clipboard } = require("electron");
  clipboard.writeText(text);
  return true;
});

// ============ PROJECT MANAGEMENT ============

// Get list of all projects
ipcMain.handle("projects:list", async () => {
  const dir = await ensureTranscriptionsDir();
  console.log("projects:list - Loading from:", dir);
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const projects = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(dir, entry.name);
        const metaPath = path.join(projectPath, "project.json");
        
        try {
          const metaContent = await fs.readFile(metaPath, "utf-8");
          const meta = JSON.parse(metaContent);
          const project = {
            id: entry.name,
            path: projectPath,
            ...meta
          };
          console.log("projects:list - Found project:", entry.name, "segments:", project.segments?.length || 0);
          projects.push(project);
        } catch {
          // No valid project.json, skip
        }
      }
    }
    
    // Sort by creation date descending (newest first)
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log("projects:list - Returning", projects.length, "projects");
    return projects;
  } catch (err) {
    console.error("Failed to list projects:", err);
    return [];
  }
});

// Create a new project
ipcMain.handle("projects:create", async (_evt, projectData) => {
  const dir = await ensureTranscriptionsDir();
  const now = new Date();
  
  // Format: YYYYMMDD_HHMMSS
  const timestamp = now.toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .replace(/\..+/, "")
    .substring(0, 15);
  
  const projectName = projectData.name || "";
  const folderId = projectName ? `${timestamp}_${projectName.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_")}` : timestamp;
  const projectPath = path.join(dir, folderId);
  
  try {
    await fs.mkdir(projectPath, { recursive: true });
    
    const meta = {
      name: projectName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      mode: projectData.mode || "note",
      language: projectData.language || "de-DE",
      audioFiles: [],
      segments: []
    };
    
    await fs.writeFile(
      path.join(projectPath, "project.json"),
      JSON.stringify(meta, null, 2),
      "utf-8"
    );
    
    return { id: folderId, path: projectPath, ...meta };
  } catch (err) {
    console.error("Failed to create project:", err);
    throw err;
  }
});

// Per-project locks to prevent concurrent writes
const projectSaveLocks = new Map();

// Save project metadata and transcript
ipcMain.handle("projects:save", async (_evt, projectId, data) => {
  const dir = await ensureTranscriptionsDir();
  const projectPath = path.join(dir, projectId);
  const metaPath = path.join(projectPath, "project.json");
  
  // Wait for any existing save to complete for this project
  while (projectSaveLocks.get(projectId)) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Acquire lock
  projectSaveLocks.set(projectId, true);
  
  try {
    console.log("projects:save - Saving project:", projectId, "keys:", Object.keys(data));
    
    // Read existing meta
    const existingContent = await fs.readFile(metaPath, "utf-8");
    let existing;
    try {
      existing = JSON.parse(existingContent);
    } catch (parseErr) {
      console.error("projects:save - Failed to parse existing JSON, file may be corrupted:", parseErr.message);
      // Try to recover by using a clean slate with basic info
      existing = {
        name: "",
        createdAt: new Date().toISOString(),
        mode: "note",
        language: "de-DE",
        audioFiles: [],
        segments: []
      };
    }
    
    // Merge with new data - careful with arrays (segments)
    // For segments, if data.segments is provided, use it entirely (don't merge)
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    // Write atomically by writing to temp file first, then renaming
    const tempPath = metaPath + ".tmp";
    const jsonContent = JSON.stringify(updated, null, 2);
    await fs.writeFile(tempPath, jsonContent, "utf-8");
    await fs.rename(tempPath, metaPath);
    
    console.log("projects:save - Saved successfully, segments:", updated.segments?.length || 0);
    return { id: projectId, path: projectPath, ...updated };
  } catch (err) {
    console.error("Failed to save project:", err);
    throw err;
  } finally {
    // Release lock
    projectSaveLocks.delete(projectId);
  }
});

// Save audio file to project
ipcMain.handle("projects:saveAudio", async (_evt, projectId, audioData, segmentIndex) => {
  const dir = await ensureTranscriptionsDir();
  const projectPath = path.join(dir, projectId);
  const audioDir = path.join(projectPath, "audio");
  
  try {
    await fs.mkdir(audioDir, { recursive: true });
    
    const fileName = `segment_${String(segmentIndex).padStart(4, "0")}.webm`;
    const filePath = path.join(audioDir, fileName);
    
    // audioData is base64 encoded
    const buffer = Buffer.from(audioData, "base64");
    await fs.writeFile(filePath, buffer);
    
    return { fileName, filePath: path.join("audio", fileName) };
  } catch (err) {
    console.error("Failed to save audio:", err);
    throw err;
  }
});

// Load project
ipcMain.handle("projects:load", async (_evt, projectId) => {
  const dir = await ensureTranscriptionsDir();
  const projectPath = path.join(dir, projectId);
  const metaPath = path.join(projectPath, "project.json");
  
  console.log("projects:load - Loading project:", projectId);
  console.log("projects:load - Meta path:", metaPath);
  
  try {
    const metaContent = await fs.readFile(metaPath, "utf-8");
    console.log("projects:load - Raw file content length:", metaContent.length);
    
    const meta = JSON.parse(metaContent);
    console.log("projects:load - Parsed meta keys:", Object.keys(meta));
    console.log("projects:load - Has segments:", !!meta.segments, "count:", meta.segments?.length);
    console.log("projects:load - Has rawTranscript:", !!meta.rawTranscript);
    
    const result = { id: projectId, path: projectPath, ...meta };
    console.log("projects:load - Returning project with segments:", result.segments?.length);
    
    return result;
  } catch (err) {
    console.error("Failed to load project:", err);
    throw err;
  }
});

// Rename project
ipcMain.handle("projects:rename", async (_evt, projectId, newName) => {
  const dir = await ensureTranscriptionsDir();
  const projectPath = path.join(dir, projectId);
  const metaPath = path.join(projectPath, "project.json");
  
  try {
    const metaContent = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaContent);
    meta.name = newName;
    meta.updatedAt = new Date().toISOString();
    
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    
    // Optionally rename folder (keeping timestamp prefix)
    const timestamp = projectId.substring(0, 15); // YYYYMMDD_HHMMSS
    const safeName = newName.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
    const newFolderId = newName ? `${timestamp}_${safeName}` : timestamp;
    
    if (newFolderId !== projectId) {
      const newPath = path.join(dir, newFolderId);
      await fs.rename(projectPath, newPath);
      return { id: newFolderId, path: newPath, ...meta };
    }
    
    return { id: projectId, path: projectPath, ...meta };
  } catch (err) {
    console.error("Failed to rename project:", err);
    throw err;
  }
});

// Delete project
ipcMain.handle("projects:delete", async (_evt, projectId) => {
  const dir = await ensureTranscriptionsDir();
  const projectPath = path.join(dir, projectId);
  
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error("Failed to delete project:", err);
    throw err;
  }
});

// Get audio file path for playback (using custom protocol)
ipcMain.handle("projects:getAudioPath", async (_evt, projectId, audioFile) => {
  const dir = await ensureTranscriptionsDir();
  const filePath = path.join(dir, projectId, audioFile);
  
  try {
    await fs.access(filePath);
    // Use custom protocol instead of file:// for security
    // Format: audio-file://projectId/audio/segment_0000.webm
    const audioUrl = `audio-file://${projectId}/${audioFile}`;
    console.log("getAudioPath: returning", audioUrl);
    return audioUrl;
  } catch {
    console.error("getAudioPath: file not found", filePath);
    return null;
  }
});

// Get transcriptions directory path
ipcMain.handle("projects:getDir", async () => {
  return await ensureTranscriptionsDir();
});

// Open project folder in Finder/Explorer
ipcMain.handle("projects:openFolder", async (_evt, projectId) => {
  const dir = await ensureTranscriptionsDir();
  const projectPath = projectId ? path.join(dir, projectId) : dir;
  await shell.openPath(projectPath);
});

// Download project as ZIP
ipcMain.handle("projects:download", async (_evt, projectId) => {
  const archiver = require("archiver");
  const dir = await ensureTranscriptionsDir();
  const projectPath = path.join(dir, projectId);
  
  // Check if project exists
  if (!fsSync.existsSync(projectPath)) {
    throw new Error("Project not found");
  }
  
  // Read project metadata for name
  const metaPath = path.join(projectPath, "project.json");
  let projectName = projectId;
  try {
    const metaContent = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaContent);
    if (meta.name) {
      projectName = meta.name.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
    }
  } catch { /* use projectId as name */ }
  
  // Ask user where to save
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${projectName}.zip`,
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    title: "Projekt exportieren"
  });
  
  if (result.canceled || !result.filePath) {
    return null;
  }
  
  // Create ZIP archive
  return new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(result.filePath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    
    output.on("close", () => {
      console.log("projects:download - ZIP created:", result.filePath, archive.pointer(), "bytes");
      resolve(result.filePath);
    });
    
    archive.on("error", (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    archive.directory(projectPath, projectId);
    archive.finalize();
  });
});

// Upload/Import project from ZIP
ipcMain.handle("projects:upload", async () => {
  const AdmZip = require("adm-zip");
  const dir = await ensureTranscriptionsDir();
  
  // Ask user to select ZIP file
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    properties: ["openFile"],
    title: "Projekt importieren"
  });
  
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  
  const zipPath = result.filePaths[0];
  
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    // Find the project folder name (first directory in ZIP)
    let projectFolderName = null;
    for (const entry of entries) {
      if (entry.isDirectory) {
        projectFolderName = entry.entryName.split("/")[0];
        break;
      }
      // If no directory, use first file's parent
      const parts = entry.entryName.split("/");
      if (parts.length > 1) {
        projectFolderName = parts[0];
        break;
      }
    }
    
    if (!projectFolderName) {
      throw new Error("Invalid project archive - no project folder found");
    }
    
    const targetPath = path.join(dir, projectFolderName);
    
    // Check if project already exists
    if (fsSync.existsSync(targetPath)) {
      const overwrite = await dialog.showMessageBox(mainWindow, {
        type: "question",
        buttons: ["Abbrechen", "Überschreiben"],
        defaultId: 0,
        title: "Projekt existiert bereits",
        message: `Das Projekt "${projectFolderName}" existiert bereits. Überschreiben?`
      });
      
      if (overwrite.response === 0) {
        return null;
      }
      
      // Remove existing project
      await fs.rm(targetPath, { recursive: true, force: true });
    }
    
    // Extract ZIP
    zip.extractAllTo(dir, true);
    
    console.log("projects:upload - Imported project:", projectFolderName);
    return projectFolderName;
    
  } catch (err) {
    console.error("projects:upload error:", err);
    throw err;
  }
});

// Select custom transcriptions directory
ipcMain.handle("projects:selectDir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Transcriptions-Ordner auswählen"
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Native TTS - cross-platform (macOS: say, Windows: SAPI)
let ttsProcess = null;

ipcMain.handle("tts:speak", async (event, text) => {
  const { spawn, exec } = require("child_process");
  
  if (!text || !text.trim()) return { success: false };
  
  // Kill any existing TTS process
  if (ttsProcess) {
    ttsProcess.kill();
    ttsProcess = null;
  }
  
  // Clean text for speech - only keep alphanumeric, spaces, basic punctuation
  const cleanText = text
    .replace(/<[^>]+>/g, " ")     // Remove HTML tags
    .replace(/[#*`\[\]()]/g, "")  // Remove markdown chars
    .replace(/\s+/g, " ")         // Collapse whitespace
    .trim()
    .substring(0, 3000);          // Limit length
  
  console.log("TTS: Starting, platform:", process.platform, "text length:", cleanText.length);
  
  if (process.platform === "darwin") {
    // macOS: use native 'say' command with German voice
    ttsProcess = spawn("/usr/bin/say", ["-v", "Anna", cleanText]);
    
    ttsProcess.on("close", (code) => {
      console.log("TTS: say finished, code:", code);
      ttsProcess = null;
    });
    
    ttsProcess.on("error", (err) => {
      console.error("TTS: say error:", err.message);
      ttsProcess = null;
    });
    
    return { success: true, native: true };
    
  } else if (process.platform === "win32") {
    // Windows: use PowerShell with SAPI
    // Escape single quotes for PowerShell
    const escapedText = cleanText.replace(/'/g, "''");
    
    const psScript = `
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
      $synth.Speak('${escapedText}')
    `;
    
    ttsProcess = spawn("powershell", ["-NoProfile", "-Command", psScript], {
      windowsHide: true
    });
    
    ttsProcess.on("close", (code) => {
      console.log("TTS: PowerShell finished, code:", code);
      ttsProcess = null;
    });
    
    ttsProcess.on("error", (err) => {
      console.error("TTS: PowerShell error:", err.message);
      ttsProcess = null;
    });
    
    return { success: true, native: true };
    
  } else {
    // Linux: try espeak
    ttsProcess = spawn("espeak", ["-v", "de", cleanText]);
    
    ttsProcess.on("close", (code) => {
      console.log("TTS: espeak finished, code:", code);
      ttsProcess = null;
    });
    
    ttsProcess.on("error", (err) => {
      console.error("TTS: espeak not available:", err.message);
      ttsProcess = null;
      // Fall back to web speech
      return { success: false, useWebSpeech: true };
    });
    
    return { success: true, native: true };
  }
});

ipcMain.handle("tts:stop", async () => {
  const { exec } = require("child_process");
  
  if (ttsProcess) {
    ttsProcess.kill();
    ttsProcess = null;
  }
  
  // Platform-specific cleanup
  if (process.platform === "darwin") {
    exec("killall say 2>/dev/null");
  } else if (process.platform === "win32") {
    // Kill any running PowerShell speech processes
    exec('taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq TTS*" 2>nul', { windowsHide: true });
  }
  
  return { success: true };
});
