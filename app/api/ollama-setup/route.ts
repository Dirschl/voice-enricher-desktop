import { NextRequest, NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function isOllamaInstalled(): Promise<boolean> {
  // First check if Ollama API is reachable (means it's installed and running)
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) return true;
  } catch {
    // API not reachable, check binary
  }
  
  // Check common installation paths (cross-platform)
  const fs = require("fs");
  const isWindows = process.platform === "win32";
  
  const paths = isWindows
    ? [
        process.env.LOCALAPPDATA + "\\Programs\\Ollama\\ollama.exe",
        "C:\\Program Files\\Ollama\\ollama.exe",
        process.env.USERPROFILE + "\\AppData\\Local\\Programs\\Ollama\\ollama.exe",
      ]
    : [
        "/usr/local/bin/ollama",
        "/opt/homebrew/bin/ollama",
        "/usr/bin/ollama",
      ];
  
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return true;
    } catch {}
  }
  
  // Try which/where as fallback
  try {
    const cmd = isWindows ? "where ollama" : "which ollama";
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function installOllama(): Promise<{ success: boolean; message: string }> {
  const platform = process.platform;
  
  try {
    if (platform === "darwin") {
      // macOS: Try brew first, then curl
      try {
        console.log("Ollama-setup: Trying brew install...");
        await execAsync("brew install ollama", { timeout: 300000 }); // 5 min timeout
        return { success: true, message: "Ollama via Homebrew installiert" };
      } catch (brewError) {
        console.log("Ollama-setup: Brew failed, trying curl...");
        // Fallback to curl
        await execAsync("curl -fsSL https://ollama.com/install.sh | sh", { 
          timeout: 300000,
          shell: "/bin/bash"
        });
        return { success: true, message: "Ollama via curl installiert" };
      }
    } else if (platform === "linux") {
      console.log("Ollama-setup: Installing on Linux...");
      await execAsync("curl -fsSL https://ollama.com/install.sh | sh", {
        timeout: 300000,
        shell: "/bin/bash"
      });
      return { success: true, message: "Ollama installiert" };
    } else if (platform === "win32") {
      return { 
        success: false, 
        message: "Auf Windows bitte Ollama manuell installieren: https://ollama.com/download" 
      };
    }
    
    return { success: false, message: "Unbekanntes Betriebssystem" };
  } catch (error) {
    console.error("Ollama-setup: Installation failed:", error);
    const message = error instanceof Error ? error.message : "Installation fehlgeschlagen";
    return { success: false, message };
  }
}

function findOllamaBinary(): string {
  const fs = require("fs");
  const isWindows = process.platform === "win32";
  
  const paths = isWindows
    ? [
        process.env.LOCALAPPDATA + "\\Programs\\Ollama\\ollama.exe",
        "C:\\Program Files\\Ollama\\ollama.exe",
        process.env.USERPROFILE + "\\AppData\\Local\\Programs\\Ollama\\ollama.exe",
        "ollama", // fallback to PATH
      ]
    : [
        "/usr/local/bin/ollama",
        "/opt/homebrew/bin/ollama",
        "/usr/bin/ollama",
        "ollama", // fallback to PATH
      ];
  
  for (const p of paths) {
    try {
      if (p === "ollama" || (p && fs.existsSync(p))) return p;
    } catch {}
  }
  return "ollama";
}

async function startOllama(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if already running
    if (await isOllamaRunning()) {
      return { success: true, message: "Ollama läuft bereits" };
    }
    
    const ollamaBin = findOllamaBinary();
    console.log("Ollama-setup: Starting ollama serve from:", ollamaBin);
    
    // Start ollama serve in background
    const ollamaProcess = spawn(ollamaBin, ["serve"], {
      detached: true,
      stdio: "ignore",
    });
    ollamaProcess.unref();
    
    // Wait for it to start
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (await isOllamaRunning()) {
        return { success: true, message: "Ollama gestartet" };
      }
    }
    
    return { success: false, message: "Ollama konnte nicht gestartet werden" };
  } catch (error) {
    console.error("Ollama-setup: Start failed:", error);
    const message = error instanceof Error ? error.message : "Start fehlgeschlagen";
    return { success: false, message };
  }
}

async function pullModel(model: string): Promise<{ success: boolean; message: string }> {
  try {
    const ollamaBin = findOllamaBinary();
    console.log(`Ollama-setup: Pulling model ${model} using ${ollamaBin}...`);
    await execAsync(`${ollamaBin} pull ${model}`, { timeout: 600000 }); // 10 min timeout
    return { success: true, message: `Modell ${model} heruntergeladen` };
  } catch (error) {
    console.error("Ollama-setup: Pull failed:", error);
    const message = error instanceof Error ? error.message : "Download fehlgeschlagen";
    return { success: false, message };
  }
}

export async function GET() {
  const installed = await isOllamaInstalled();
  const running = await isOllamaRunning();
  
  return NextResponse.json({
    installed,
    running,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;
    const model = body.model as string;
    
    console.log("Ollama-setup: Action:", action, "Model:", model);
    
    switch (action) {
      case "check":
        return NextResponse.json({
          installed: await isOllamaInstalled(),
          running: await isOllamaRunning(),
        });
        
      case "install":
        const installResult = await installOllama();
        return NextResponse.json(installResult);
        
      case "start":
        const startResult = await startOllama();
        return NextResponse.json(startResult);
        
      case "pull":
        if (!model) {
          return NextResponse.json({ success: false, message: "Kein Modell angegeben" });
        }
        const pullResult = await pullModel(model);
        return NextResponse.json(pullResult);
        
      case "setup":
        // Full setup: install if needed, start, pull model
        const steps: string[] = [];
        
        // 1. Check/Install
        if (!(await isOllamaInstalled())) {
          steps.push("Installiere Ollama...");
          const install = await installOllama();
          if (!install.success) {
            return NextResponse.json({ success: false, message: install.message, steps });
          }
          steps.push(install.message);
        } else {
          steps.push("Ollama bereits installiert");
        }
        
        // 2. Start
        if (!(await isOllamaRunning())) {
          steps.push("Starte Ollama...");
          const start = await startOllama();
          if (!start.success) {
            return NextResponse.json({ success: false, message: start.message, steps });
          }
          steps.push(start.message);
        } else {
          steps.push("Ollama läuft bereits");
        }
        
        // 3. Pull model if specified
        if (model) {
          steps.push(`Lade Modell ${model}...`);
          const pull = await pullModel(model);
          if (!pull.success) {
            return NextResponse.json({ success: false, message: pull.message, steps });
          }
          steps.push(pull.message);
        }
        
        return NextResponse.json({ success: true, message: "Setup abgeschlossen", steps });
        
      default:
        return NextResponse.json({ success: false, message: "Unbekannte Aktion" });
    }
  } catch (error) {
    console.error("Ollama-setup error:", error);
    const message = error instanceof Error ? error.message : "Fehler";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
