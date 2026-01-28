import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { findFFmpeg } from "../../../lib/ffmpeg";

const execAsync = promisify(exec);

async function installFFmpeg(): Promise<{ success: boolean; message: string; needsBrew?: boolean }> {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS: Homebrew
      try {
        await execAsync("brew --version", { timeout: 5000 });
      } catch {
        return {
          success: false,
          message: "Homebrew nicht gefunden. Bitte zuerst installieren: https://brew.sh",
          needsBrew: true,
        };
      }
      console.log("FFmpeg-setup: Running brew install ffmpeg...");
      await execAsync("brew install ffmpeg", { timeout: 300000 }); // 5 min
      return { success: true, message: "FFmpeg via Homebrew installiert" };
    }

    if (platform === "linux") {
      // apt benötigt in der Regel sudo; aus der App ohne TTY oft nicht möglich
      console.log("FFmpeg-setup: Trying apt install ffmpeg...");
      try {
        await execAsync("apt-get update && apt-get install -y ffmpeg", {
          timeout: 300000,
          shell: "/bin/bash",
        });
        return { success: true, message: "FFmpeg installiert" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          message: `Automatische Installation fehlgeschlagen. Bitte im Terminal: sudo apt install ffmpeg (${msg})`,
        };
      }
    }

    if (platform === "win32") {
      try {
        console.log("FFmpeg-setup: Running winget install ffmpeg...");
        await execAsync("winget install ffmpeg --accept-source-agreements --accept-package-agreements", {
          timeout: 300000,
          windowsHide: true,
        });
        return { success: true, message: "FFmpeg via winget installiert. App ggf. neu starten." };
      } catch (e) {
        return {
          success: false,
          message: "winget fehlgeschlagen. Bitte manuell: winget install ffmpeg oder https://ffmpeg.org/download.html",
        };
      }
    }

    return { success: false, message: "Unbekanntes Betriebssystem" };
  } catch (error) {
    console.error("FFmpeg-setup: Install failed:", error);
    const message = error instanceof Error ? error.message : "Installation fehlgeschlagen";
    return { success: false, message };
  }
}

export async function GET() {
  const path = await findFFmpeg();
  return NextResponse.json({ installed: !!path, path: path || undefined });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "check";

    if (action === "check") {
      const path = await findFFmpeg();
      return NextResponse.json({ installed: !!path, path: path || undefined });
    }

    if (action === "install") {
      const result = await installFFmpeg();
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, message: "Unbekannte Aktion" }, { status: 400 });
  } catch (error) {
    console.error("FFmpeg-setup error:", error);
    const message = error instanceof Error ? error.message : "Fehler";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
